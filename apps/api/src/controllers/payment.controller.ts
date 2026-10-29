import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { WebSocketService } from '../services/socket.service';
import { getApiBaseUrl } from '@printqr/config';
import QRCode from 'qrcode';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { PaymentGatewayService, canManageShopPayment, canReviewManualUpiPayment, decryptPaymentCredential, encryptPaymentCredential, isValidUpiVpa, verifyRazorpaySignature, verifyRazorpayWebhookSignature } from '../services/payment.service';
import { EmailService } from '../services/email.service';

const matchesSecret = (expected: string, candidate: unknown): boolean => {
  if (typeof candidate !== 'string') return false;
  const expectedBytes = Buffer.from(expected);
  const candidateBytes = Buffer.from(candidate);
  return expectedBytes.length === candidateBytes.length && crypto.timingSafeEqual(expectedBytes, candidateBytes);
};

export class PaymentController {
  /** Create a platform-merchant Razorpay order for SaaS subscription billing. */
  static async createSubscriptionPaymentOrder(req: Request, res: Response, next: NextFunction) {
    try {
      if (!EmailService.isConfigured()) return res.status(503).json({ success: false, code: 'EMAIL_DELIVERY_UNAVAILABLE', message: 'Shop registration requires configured email verification before subscription checkout.' });
      const { planId } = req.body;
      if (typeof planId !== 'string' || !planId) return res.status(400).json({ success: false, message: 'A subscription plan is required' });
      try {
        const checkout = await PaymentGatewayService.createSubscriptionOrder(planId);
        return res.status(201).json({ success: true, data: checkout });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not create subscription checkout';
        const status = /not configured/i.test(message) ? 503 : /not found|valid monthly price/i.test(message) ? 400 : 502;
        return res.status(status).json({ success: false, message });
      }
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create Gateway Order (Razorpay, Cashfree, Stripe, UPI)
   * Calculates the exact server-side amount and returns the checkout configuration
   */
  static async createPaymentOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderNumber, trackingToken, gateway = 'RAZORPAY' } = req.body;

      if (!orderNumber) {
        return res.status(400).json({ success: false, message: 'Order number is required' });
      }

      const order = await prisma.order.findUnique({
        where: { orderNumber },
        include: {
          shop: {
            include: {
              gateways: { where: { isEnabled: true } },
            },
          },
        },
      });

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      if (!matchesSecret(order.trackingToken, trackingToken)) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      if (order.paymentStatus === 'PAID') {
        return res.status(200).json({
          success: true,
          message: 'Order is already paid',
          data: {
            orderNumber: order.orderNumber,
            paymentStatus: 'PAID',
            printStatus: order.printStatus,
          },
        });
      }

      // Server-side calculated amount (never trust frontend amount)
      const amount = order.totalAmount;
      const currency = 'INR';
      const cleanGateway = String(gateway).toUpperCase();
      if (!['RAZORPAY', 'UPI'].includes(cleanGateway)) {
        return res.status(400).json({ success: false, message: 'This payment method is not available for customer checkout' });
      }
      if (order.paymentStatus !== 'PENDING') {
        return res.status(409).json({ success: false, message: 'This order is not eligible for online payment' });
      }

      if ((cleanGateway === 'UPI' && order.paymentMethod !== 'UPI') || (cleanGateway === 'RAZORPAY' && !order.paymentMethod.startsWith('RAZORPAY'))) {
        return res.status(409).json({ success: false, message: 'Selected gateway does not match this order payment method' });
      }

      // Customer print revenue is paid only to its shop, never to platform credentials.
      const shopGateway = order.shop.gateways.find((g) => g.provider.toUpperCase() === cleanGateway);
      // Customer print revenue must be paid to this shop. Platform credentials
      // are reserved for OR PRINT subscription billing and never used as fallback.
      const effectiveGateway = shopGateway;
      const key = effectiveGateway?.apiKey;
      
      // Shop's own UPI VPA (money goes directly to shop owner)
      const shopUpiGateway = order.shop.gateways.find((g) => g.provider.toUpperCase() === 'UPI' && g.isEnabled);
      const upiVpa = shopUpiGateway?.upiVpa;
      if (cleanGateway === 'UPI' && !upiVpa) {
        return res.status(503).json({ success: false, message: 'UPI payment is not configured for this shop' });
      }
      const shopDisplayName = shopUpiGateway?.merchantId || order.shop.name;
      const shopInstructions = shopUpiGateway?.apiKey || 'Scan & Pay directly to Shop';
      const existingPayment = await prisma.payment.findFirst({ where: { orderId: order.id, status: 'PENDING' } });

      let gatewayOrderId = cleanGateway === 'UPI' && existingPayment?.gateway === 'UPI' && existingPayment.gatewayOrderId
        ? existingPayment.gatewayOrderId
        : `upi_${crypto.randomBytes(16).toString('hex')}`;
      if (cleanGateway === 'RAZORPAY') {
        const secret = decryptPaymentCredential(effectiveGateway?.apiSecret);
        if (!key || !secret) {
          return res.status(503).json({ success: false, message: 'Razorpay checkout is not configured for this shop' });
        }
        const expectedPrefix = effectiveGateway?.isTestMode ? 'rzp_test_' : 'rzp_live_';
        if (!key.startsWith(expectedPrefix)) return res.status(409).json({ success: false, message: `Razorpay key must match the shop’s ${effectiveGateway?.isTestMode ? 'test' : 'live'} mode` });
        if (existingPayment?.gateway === 'RAZORPAY' && existingPayment.gatewayOrderId) {
          gatewayOrderId = existingPayment.gatewayOrderId;
        } else {
        const razorpay = new Razorpay({ key_id: key, key_secret: secret });
        const createdGatewayOrder = await razorpay.orders.create({
          amount: Math.round(amount * 100),
          currency,
          receipt: order.orderNumber,
        });
        gatewayOrderId = createdGatewayOrder.id;
        }
      }

      // Upsert Payment record
      let activePayment;
      if (existingPayment) {
        activePayment = await prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            gateway: cleanGateway,
            paymentMethod: cleanGateway,
            gatewayOrderId,
            amount,
          },
        });
      } else {
        activePayment = await prisma.payment.create({
          data: {
            orderId: order.id,
            gateway: cleanGateway,
            paymentMethod: cleanGateway,
            gatewayOrderId,
            amount,
            status: 'PENDING',
          },
        });
      }

      // Generate dynamic standard NPCI UPI URI with exact server-calculated amount
      const upiString = `upi://pay?pa=${encodeURIComponent(upiVpa || '')}&pn=${encodeURIComponent(
        shopDisplayName
      )}&am=${amount.toFixed(2)}&tr=${order.orderNumber}&cu=INR&tn=${encodeURIComponent(
        `Print Order ${order.orderNumber}`
      )}`;

      let upiQrDataUrl = '';
      try {
        upiQrDataUrl = await QRCode.toDataURL(upiString, {
          margin: 1,
          width: 380,
          color: { dark: '#080c14', light: '#ffffff' },
        });
      } catch (qrErr) {
        console.error('Failed to generate UPI QR code:', qrErr);
      }

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      return res.status(200).json({
        success: true,
        message: 'Payment order created successfully',
        data: {
          gateway: cleanGateway,
          paymentId: activePayment.id,
          orderNumber: order.orderNumber,
          gatewayOrderId,
          amount: Math.round(amount * 100), // amount in paise for Razorpay/Cashfree
          amountFormatted: amount.toFixed(2),
          currency,
          key: cleanGateway === 'RAZORPAY' ? key : undefined,
          shopName: shopDisplayName,
          shopUpiVpa: upiVpa,
          customerName: order.customerName || 'Customer',
          customerPhone: order.customerPhone || '9876543210',
          customerEmail: order.customerEmail || 'customer@anishnova.com',
          upiString,
          upiQrDataUrl,
          expiresAt,
          instructions: shopInstructions,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get Live Payment & Print Status for an Order
   */
  static async getPaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderNumber } = req.params;
      const token = req.query.token;

      const order = await prisma.order.findUnique({
        where: { orderNumber },
        include: {
          items: { include: { file: true } },
          shop: true,
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      if (!matchesSecret(order.trackingToken, token)) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const latestPayment = order.payments[0];
      const isVerified = order.paymentStatus === 'PAID' || order.paymentStatus === 'PAYMENT_VERIFIED';

      return res.status(200).json({
        success: true,
        data: {
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          amountFormatted: order.totalAmount.toFixed(2),
          currency: 'INR',
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          printStatus: order.printStatus,
          isVerified,
          transactionRef: latestPayment?.transactionRef || null,
          paymentId: latestPayment?.id || null,
          shopName: order.shop.name,
          shopLogo: order.shop.logoUrl || null,
          updatedAt: order.updatedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public Shop Available Payment Methods
   */
  static async getShopPaymentMethods(req: Request, res: Response, next: NextFunction) {
    try {
      const { shopSlug } = req.params;

      const shop = await prisma.shop.findFirst({
        where: { OR: [{ slug: shopSlug }, { id: shopSlug }] },
        include: { gateways: true },
      });

      if (!shop) return res.status(404).json({ success: false, message: 'Print shop not found' });

      const shopUpi = shop.gateways.find((gateway) => gateway.provider.toUpperCase() === 'UPI');
      const cashConfig = shop.gateways.find((gateway) => gateway.provider.toUpperCase() === 'PAY_AT_COUNTER');
      const cashEnabled = cashConfig ? cashConfig.isEnabled : true;
      const razorpay = shop.gateways.find((gateway) => gateway.provider.toUpperCase() === 'RAZORPAY' && gateway.isEnabled && gateway.apiKey && decryptPaymentCredential(gateway.apiSecret));
      const hasConfiguredUpi = Boolean(shopUpi?.upiVpa);

      return res.status(200).json({
        success: true,
        data: {
          shopName: shop.name,
          slug: shop.slug,
          methods: [
            { id: 'UPI', label: 'UPI transfer (manual verification)', enabled: hasConfiguredUpi && Boolean(shopUpi?.isEnabled), icon: 'qr' },
            { id: 'PAY_AT_COUNTER', label: 'Cash at shop', enabled: cashEnabled, icon: 'cash' },
            { id: 'RAZORPAY_CARD', label: 'Online payment', enabled: Boolean(razorpay), icon: 'card' },
          ],
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Verifies online payment signature (Razorpay, Cashfree, Stripe, UPI)
   * AUTOMATICALLY confirms the order and dispatches print jobs to the Windows Print Agent with ZERO human approval!
   */
  static async verifyOnlinePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentId, razorpayPaymentId, razorpaySignature, razorpayOrderId } = req.body;
      if (![paymentId, razorpayPaymentId, razorpaySignature, razorpayOrderId].every((value) => typeof value === 'string' && value.length > 0)) {
        return res.status(400).json({ success: false, message: 'A payment ID, Razorpay order ID, payment ID, and signature are required' });
      }

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { order: { include: {
          shop: { include: { printers: true, gateways: true } },
          items: { include: { file: true } },
          printJobs: true,
        } } },
      });

      if (!payment || !payment.order) {
        return res.status(404).json({ success: false, message: 'Payment or order not found' });
      }

      const order = payment.order;
      if (!order.paymentMethod.startsWith('RAZORPAY') || payment.amount !== order.totalAmount) {
        return res.status(409).json({ success: false, message: 'Payment does not match this Razorpay order amount or method' });
      }
      const gateway = order.shop.gateways.find((entry) => entry.provider === 'RAZORPAY' && entry.isEnabled);
      const secret = decryptPaymentCredential(gateway?.apiSecret);
      if (!secret) return res.status(503).json({ success: false, message: 'Razorpay verification is not configured' });
      if (payment.gateway !== 'RAZORPAY' || payment.gatewayOrderId !== razorpayOrderId) {
        return res.status(400).json({ success: false, message: 'Payment does not match this Razorpay order' });
      }
      if (!verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature, secret)) {
        return res.status(400).json({ success: false, message: 'Invalid payment signature' });
      }
      const razorpay = new Razorpay({ key_id: gateway!.apiKey || '', key_secret: secret });
      const providerPayment = await razorpay.payments.fetch(razorpayPaymentId);
      if (providerPayment.order_id !== razorpayOrderId || providerPayment.amount !== Math.round(payment.amount * 100) || providerPayment.currency !== 'INR' || providerPayment.status !== 'captured') {
        return res.status(409).json({ success: false, message: 'Razorpay has not confirmed a captured payment for this order amount' });
      }
      if (payment.status === 'PAID' || order.paymentStatus === 'PAID') {
        return res.status(200).json({ success: true, message: 'Payment was already verified', data: { orderNumber: order.orderNumber, paymentStatus: 'PAID', printStatus: order.printStatus } });
      }

      // Update payment and order to PAID / QUEUED in a transaction
      const updatedOrder = await prisma.$transaction(async (tx) => {
        const orderChanged = await tx.order.updateMany({ where: { id: order.id, paymentStatus: 'PENDING' }, data: { paymentStatus: 'PAID', printStatus: 'QUEUED' } });
        if (!orderChanged.count) return null;
        const paymentChanged = await tx.payment.updateMany({
          where: { id: payment.id, status: 'PENDING', gateway: 'RAZORPAY', gatewayOrderId: razorpayOrderId },
          data: { status: 'PAID', transactionRef: razorpayPaymentId, verifiedAt: new Date() },
        });
        if (!paymentChanged.count) throw new Error('RAZORPAY_PAYMENT_STATE_CONFLICT');
        await tx.transaction.create({
          data: {
            paymentId: payment.id,
            type: 'PAYMENT',
            amount: payment.amount,
            status: 'SUCCESS',
            description: `Online payment verified for Order ${order.orderNumber}`,
          },
        });

        return await tx.order.findUnique({
          where: { id: order.id },
          include: { items: { include: { file: true } }, printJobs: { include: { printer: true } } },
        });
      });
      if (!updatedOrder) return res.status(200).json({ success: true, message: 'Payment was already verified', data: { orderNumber: order.orderNumber, paymentStatus: order.paymentStatus, printStatus: order.printStatus } });

      // 🚀 AUTOMATIC PHYSICAL PRINT SPOOLING
      // Dispatch print jobs directly to the shop's Windows Print Agent
      for (const job of updatedOrder.printJobs) {
        const item = updatedOrder.items.find((i) => i.id === job.orderItemId);
        if (item && item.file) {
          WebSocketService.dispatchPrintJob({
            id: job.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderItemId: item.id,
            shopId: order.shopId,
            printerId: job.printerId,
            fileUrl: `${getApiBaseUrl()}${item.file.url}`,
            fileName: item.file.originalName,
            mimeType: item.file.mimeType,
            settings: {
              colorMode: item.colorMode as any,
              paperSize: item.paperSize as any,
              orientation: item.orientation as any,
              duplexMode: item.duplexMode as any,
              copies: item.copies,
              pageRange: item.pageRange,
              pagesPerSheet: item.pagesPerSheet as any,
              quality: item.quality as any,
              selectedPagesCount: item.selectedPagesCount,
            },
            idempotencyKey: job.idempotencyKey,
            status: 'QUEUED',
            progressPercent: 0,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
            createdAt: job.createdAt.toISOString(),
          });
        }
      }

      // Real-time broadcast to customer live tracking room
      WebSocketService.broadcastOrderUpdate(order.orderNumber, order.shopId, updatedOrder);

      return res.status(200).json({
        success: true,
        message: 'Online payment verified successfully! Print job automatically dispatched to printer.',
        data: {
          orderNumber: order.orderNumber,
          paymentStatus: 'PAID',
          printStatus: 'QUEUED',
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Razorpay Webhook Handler
   */
  static async handleRazorpayWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      const event = req.body;
      // Only captured payment events are fulfillment signals. `order.paid`
      // alone has no captured payment ID/amount here, so status is confirmed by
      // the Checkout callback or a later payment.captured webhook.
      if (event?.event !== 'payment.captured') return res.status(200).json({ status: 'ignored' });
      const entity = event.payload?.payment?.entity;
      const razorpayOrderId = entity?.order_id;
      const subscriptionAttempt = typeof razorpayOrderId === 'string'
        ? await prisma.subscriptionPaymentAttempt.findUnique({ where: { gatewayOrderId: razorpayOrderId } })
        : null;
      const payment = razorpayOrderId
        ? await prisma.payment.findFirst({
            where: { gatewayOrderId: razorpayOrderId, gateway: 'RAZORPAY' },
            include: {
              order: {
                include: {
                  shop: { include: { gateways: { where: { provider: 'RAZORPAY' } }, printers: true } },
                  items: { include: { file: true } },
                  printJobs: true,
                },
              },
            },
          })
        : null;
      const shopWebhookSecret = payment?.order.shop.gateways.find((item) => item.isEnabled)?.webhookSecret;
      const webhookSecret = payment
        ? decryptPaymentCredential(shopWebhookSecret)
        : subscriptionAttempt ? process.env.RAZORPAY_WEBHOOK_SECRET : null;
      if (!signature || !rawBody?.length || !webhookSecret) {
        return res.status(503).json({ success: false, message: 'Razorpay webhook signature verification is not configured' });
      }
      if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
        return res.status(400).json({ success: false, message: 'Invalid Razorpay webhook signature' });
      }
      if (subscriptionAttempt) {
        if (entity?.status !== 'captured' || typeof entity.id !== 'string' || entity.amount !== subscriptionAttempt.amountPaise || entity.currency !== subscriptionAttempt.currency) {
          return res.status(200).json({ status: 'ignored' });
        }
        if (subscriptionAttempt.status === 'PAID' && subscriptionAttempt.gatewayPaymentId === entity.id) return res.status(200).json({ status: 'already_processed' });
        const claimed = await prisma.subscriptionPaymentAttempt.updateMany({
          where: { id: subscriptionAttempt.id, status: 'PENDING', expiresAt: { gt: new Date() } },
          data: { status: 'PAID', gatewayPaymentId: entity.id },
        });
        return res.status(200).json({ status: claimed.count ? 'payment_verified_registration_pending' : 'already_processed' });
      }
      if (!payment || !payment.order || entity?.status !== 'captured' || typeof entity.id !== 'string' || entity.amount !== Math.round(payment.amount * 100) || entity.currency !== 'INR') {
        return res.status(200).json({ status: 'ignored' });
      }
      if (payment.status === 'PAID' || payment.order.paymentStatus === 'PAID') return res.status(200).json({ status: 'already_processed' });

      const updatedOrder = await prisma.$transaction(async (tx) => {
        const orderChanged = await tx.order.updateMany({ where: { id: payment.orderId, paymentStatus: 'PENDING' }, data: { paymentStatus: 'PAID', printStatus: 'QUEUED' } });
        if (!orderChanged.count) return null;
        const paymentChanged = await tx.payment.updateMany({
          where: { id: payment.id, status: 'PENDING', gateway: 'RAZORPAY', gatewayOrderId: razorpayOrderId },
          data: { status: 'PAID', transactionRef: entity.id, verifiedAt: new Date() },
        });
        if (!paymentChanged.count) throw new Error('RAZORPAY_PAYMENT_STATE_CONFLICT');
        await tx.transaction.create({ data: { paymentId: payment.id, type: 'PAYMENT', amount: payment.amount, status: 'SUCCESS', description: `Razorpay payment captured for Order ${payment.order.orderNumber}` } });
        return tx.order.findUnique({ where: { id: payment.orderId }, include: { items: { include: { file: true } }, printJobs: true } });
      });
      if (!updatedOrder) return res.status(200).json({ status: 'already_processed' });
      for (const job of updatedOrder.printJobs) {
        const item = updatedOrder.items.find((entry) => entry.id === job.orderItemId);
        if (!item || !item.file) continue;
        WebSocketService.dispatchPrintJob({ id: job.id, orderId: updatedOrder.id, orderNumber: updatedOrder.orderNumber, orderItemId: item.id, shopId: updatedOrder.shopId, printerId: job.printerId, fileUrl: `${getApiBaseUrl()}${item.file.url}`, fileName: item.file.originalName, mimeType: item.file.mimeType, settings: { colorMode: item.colorMode as any, paperSize: item.paperSize as any, orientation: item.orientation as any, duplexMode: item.duplexMode as any, copies: item.copies, pageRange: item.pageRange, pagesPerSheet: item.pagesPerSheet as any, quality: item.quality as any, selectedPagesCount: item.selectedPagesCount }, idempotencyKey: job.idempotencyKey, status: 'QUEUED', progressPercent: 0, attempts: job.attempts, maxAttempts: job.maxAttempts, createdAt: job.createdAt.toISOString() });
      }
      WebSocketService.broadcastOrderUpdate(updatedOrder.orderNumber, updatedOrder.shopId, updatedOrder);
      return res.status(200).json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Cashfree Webhook Handler with Signature Verification
   */
  static async handleCashfreeWebhook(_req: Request, res: Response, _next: NextFunction) {
    return res.status(503).json({ success: false, message: 'Cashfree checkout is not implemented; no payment events are accepted' });
  }
  static async handleStripeWebhook(_req: Request, res: Response, _next: NextFunction) {
    return res.status(503).json({ success: false, message: 'Stripe payments are not enabled; no payment events are accepted' });
  }
  static async getShopGateways(req: Request, res: Response, next: NextFunction) {
    try {
      let shopId = req.user?.shopId;
      if (!shopId && req.user?.id) {
        const owned = await prisma.shop.findFirst({ where: { ownerId: req.user.id } });
        if (owned) shopId = owned.id;
      }

      if (!shopId) return res.status(400).json({ success: false, message: 'Shop ID required' });

      const gateways = await prisma.paymentGatewayConfig.findMany({
        where: { shopId },
      });

      const result = gateways.map((g) => ({
        id: g.id,
        provider: g.provider,
        apiKey: g.apiKey || '',
        secretConfigured: Boolean(g.apiSecret),
        webhookSecretConfigured: Boolean(g.webhookSecret),
        merchantId: g.merchantId || '',
        upiVpa: g.upiVpa || '',
        isTestMode: g.isTestMode,
        isEnabled: g.isEnabled,
        status: g.isEnabled && (g.apiKey || g.upiVpa) ? 'CONFIGURED' : (g.apiKey || g.upiVpa ? 'INACTIVE' : 'NOT_CONFIGURED'),
        updatedAt: g.updatedAt,
      }));

      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Shop Owner: Save/Update payment gateway
   */
  static async updateShopGateway(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user?.role === 'SHOP_STAFF') return res.status(403).json({ success: false, message: 'Only the shop owner or an administrator can change payment settings' });
      let shopId = req.user?.shopId;
      if (!shopId && req.user?.id) {
        const owned = await prisma.shop.findFirst({ where: { ownerId: req.user.id } });
        if (owned) shopId = owned.id;
      }

      if (!shopId) return res.status(400).json({ success: false, message: 'Shop ID required' });

      const { provider, apiKey, apiSecret, webhookSecret, merchantId, upiVpa, isTestMode, isEnabled } = req.body;
      const cleanProvider = String(provider).toUpperCase();
      if (!['UPI', 'RAZORPAY', 'PAY_AT_COUNTER'].includes(cleanProvider)) {
        return res.status(400).json({ success: false, message: 'Unsupported payment provider' });
      }
      if (cleanProvider === 'UPI' && upiVpa !== undefined && !isValidUpiVpa(String(upiVpa))) {
        return res.status(400).json({ success: false, message: 'Enter a valid UPI ID such as shop@bank' });
      }

      const existing = await prisma.paymentGatewayConfig.findFirst({
        where: { shopId, provider: cleanProvider },
      });

      // Avoid overwriting with mask placeholder
      let cleanSecret = existing?.apiSecret || null;
      let cleanWebhook = existing?.webhookSecret || null;
      try {
        if (typeof apiSecret === 'string' && apiSecret && !apiSecret.includes('•')) cleanSecret = encryptPaymentCredential(apiSecret);
        if (typeof webhookSecret === 'string' && webhookSecret && !webhookSecret.includes('•')) cleanWebhook = encryptPaymentCredential(webhookSecret);
      } catch (error) {
        return res.status(503).json({ success: false, message: error instanceof Error ? error.message : 'Payment credential encryption is not configured' });
      }

      let gateway;
      if (existing) {
        gateway = await prisma.paymentGatewayConfig.update({
          where: { id: existing.id },
          data: {
            apiKey: apiKey !== undefined ? apiKey : existing.apiKey,
            apiSecret: cleanSecret,
            webhookSecret: cleanWebhook,
            merchantId: merchantId !== undefined ? merchantId : existing.merchantId,
            upiVpa: upiVpa !== undefined ? upiVpa : existing.upiVpa,
            isTestMode: typeof isTestMode === 'boolean' ? isTestMode : existing.isTestMode,
            isEnabled: typeof isEnabled === 'boolean' ? isEnabled : existing.isEnabled,
          },
        });
      } else {
        gateway = await prisma.paymentGatewayConfig.create({
          data: {
            shopId,
            provider: cleanProvider,
            apiKey: apiKey || null,
            apiSecret: cleanSecret || null,
            webhookSecret: cleanWebhook || null,
            merchantId: merchantId || null,
            upiVpa: upiVpa || null,
            isTestMode: typeof isTestMode === 'boolean' ? isTestMode : true,
            isEnabled: typeof isEnabled === 'boolean' ? isEnabled : true,
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: `${cleanProvider} configuration saved successfully`,
        data: {
          id: gateway.id,
          provider: gateway.provider,
          apiKey: gateway.apiKey || '',
          secretConfigured: Boolean(gateway.apiSecret),
          webhookSecretConfigured: Boolean(gateway.webhookSecret),
          upiVpa: gateway.upiVpa || '',
          isEnabled: gateway.isEnabled,
          isTestMode: gateway.isTestMode,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Test Gateway Connection Handshake
   */
  static async testConnection(req: Request, res: Response, next: NextFunction) {
    try {
      let shopId = req.user?.shopId;
      if (!shopId && req.user?.id) {
        const owned = await prisma.shop.findFirst({ where: { ownerId: req.user.id } });
        if (owned) shopId = owned.id;
      }

      const { provider } = req.body;
      const cleanProvider = provider ? String(provider).toUpperCase() : null;

      const whereClause: any = { shopId: shopId || null };
      if (cleanProvider) whereClause.provider = cleanProvider;

      const configs = await prisma.paymentGatewayConfig.findMany({
        where: whereClause,
      });

      if (configs.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No payment gateways currently configured.',
          results: [],
        });
      }

      const results = configs.map((c) => {
        let ok = true;
        let note = 'Connection Verified';

        if (c.provider === 'UPI') {
          if (!c.upiVpa || !c.upiVpa.includes('@')) {
            ok = false;
            note = 'Invalid UPI VPA format (e.g. name@bank required)';
          }
        } else if (c.provider === 'RAZORPAY') {
          ok = Boolean(c.apiKey?.startsWith('rzp_') && decryptPaymentCredential(c.apiSecret));
          note = ok ? 'Credentials are present and formatted. No live provider payment was performed.' : 'A Razorpay key ID and secret are required.';
        } else if (c.provider === 'PAY_AT_COUNTER') {
          ok = true;
          note = c.isEnabled ? 'Cash is enabled; collection must be confirmed by shop staff.' : 'Cash is disabled for customers.';
        }

        return {
          provider: c.provider,
          status: c.provider === 'UPI' && ok ? 'FORMAT_VALIDATED' : c.provider === 'RAZORPAY' && ok ? 'CONFIGURED' : ok ? 'CONFIGURED' : 'FAILED',
          message: note,
        };
      });

      return res.status(200).json({
        success: true,
        message: 'Payment handshake verification complete',
        results,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Customer submits UPI UTR / Transaction Reference after paying via UPI App or scanning QR
   */
  static async submitUpiProof(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderNumber, trackingToken, utrReference, customerUpiVpa, note } = req.body;

      if (!orderNumber || !utrReference) {
        return res.status(400).json({ success: false, message: 'Order number and UTR reference are required' });
      }

      const cleanUtr = String(utrReference).trim().toUpperCase();
      if (cleanUtr.length < 4) {
        return res.status(400).json({ success: false, message: 'Please enter a valid UPI UTR or Reference ID' });
      }

      const order = await prisma.order.findUnique({
        where: { orderNumber },
        include: { shop: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      if (!matchesSecret(order.trackingToken, trackingToken)) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      if (order.paymentStatus === 'PAID') {
        return res.status(200).json({
          success: true,
          message: 'Order is already verified as paid',
          data: { orderNumber, paymentStatus: 'PAID' },
        });
      }
      if (order.paymentMethod !== 'UPI' || order.paymentStatus !== 'PENDING') {
        return res.status(409).json({ success: false, message: 'This order is not awaiting a manual UPI payment reference' });
      }

      // Update payment record with UTR
      const payment = order.payments[0];
      if (!payment || payment.gateway !== 'UPI' || payment.amount !== order.totalAmount) {
        return res.status(409).json({ success: false, message: 'A matching pending UPI payment record is not available' });
      }
      let updatedOrder;
      try {
        updatedOrder = await prisma.$transaction(async (tx) => {
          const changedOrder = await tx.order.updateMany({ where: { id: order.id, paymentStatus: 'PENDING', paymentMethod: 'UPI' }, data: { paymentStatus: 'PAYMENT_SUBMITTED', notes: note ? `${order.notes ? `${order.notes} | ` : ''}UTR: ${cleanUtr} (${String(note).slice(0, 300)})` : order.notes } });
          if (!changedOrder.count) throw new Error('UPI_PROOF_STATE_CONFLICT');
          const changedPayment = await tx.payment.updateMany({ where: { id: payment.id, status: 'PENDING', transactionRef: payment.transactionRef }, data: { transactionRef: cleanUtr, rawResponse: JSON.stringify({ submittedAt: new Date().toISOString() }) } });
          if (!changedPayment.count) throw new Error('UPI_PROOF_STATE_CONFLICT');
          return tx.order.findUnique({ where: { id: order.id }, include: { shop: true, items: { include: { file: true } } } });
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'UPI_PROOF_STATE_CONFLICT') return res.status(409).json({ success: false, message: 'Payment reference was already submitted or the order has changed' });
        throw error;
      }
      if (!updatedOrder) return res.status(409).json({ success: false, message: 'Order could not be updated' });

      // Broadcast to Shop Owner Dashboard live room
      WebSocketService.broadcastUpiPaymentSubmitted(order.shopId, {
        orderNumber: order.orderNumber,
        orderId: order.id,
        utrReference: cleanUtr,
        customerUpiVpa: customerUpiVpa || null,
        amount: order.totalAmount,
        customerName: order.customerName,
        shopName: order.shop.name,
        submittedAt: new Date().toISOString(),
      });

      // Broadcast to customer live order tracking room
      WebSocketService.broadcastOrderUpdate(order.orderNumber, order.shopId, updatedOrder);

      return res.status(200).json({
        success: true,
        message: 'Payment proof submitted successfully! Verification in progress with shop.',
        data: {
          orderNumber: order.orderNumber,
          utrReference: cleanUtr,
          paymentStatus: 'PAYMENT_SUBMITTED',
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Shop Owner or Staff verifies direct UPI payment from their banking app and releases printing
   */
  static async verifyShopUpiPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderNumber, action = 'APPROVE', rejectReason } = req.body;

      if (!orderNumber) {
        return res.status(400).json({ success: false, message: 'Order number is required' });
      }

      const order = await prisma.order.findUnique({
        where: { orderNumber },
        include: {
          shop: { include: { printers: true } },
          items: { include: { file: true } },
          printJobs: { include: { printer: true } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      const reviewerShopId = req.user?.shopId || (req.user?.role === 'SHOP_OWNER' ? (await prisma.shop.findFirst({ where: { ownerId: req.user.id }, select: { id: true } }))?.id : undefined);
      if (!canManageShopPayment(req.user?.role || '', reviewerShopId, order.shopId)) {
        return res.status(403).json({ success: false, message: 'You are not authorized to manage this order' });
      }
      const payment = order.payments[0];
      if (!payment || !canReviewManualUpiPayment(order.paymentMethod, order.paymentStatus, payment.gateway, payment.transactionRef, payment.amount, order.totalAmount)) {
        return res.status(409).json({ success: false, message: 'A submitted UPI payment proof is required before review' });
      }
      if (payment.status !== 'PENDING') {
        return res.status(409).json({ success: false, message: 'Payment amount or status does not match this order' });
      }
      if (!['APPROVE', 'REJECT'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Action must be APPROVE or REJECT' });
      }

      let updatedOrder;
      try {
        updatedOrder = await prisma.$transaction(async (tx) => {
          const changedOrder = await tx.order.updateMany({ where: { id: order.id, paymentStatus: 'PAYMENT_SUBMITTED' }, data: action === 'APPROVE' ? { paymentStatus: 'PAID', printStatus: 'QUEUED' } : { paymentStatus: 'PAYMENT_FAILED', printStatus: 'CANCELLED' } });
          if (!changedOrder.count) throw new Error('UPI_REVIEW_STATE_CONFLICT');
          const changedPayment = await tx.payment.updateMany({ where: { id: payment.id, status: 'PENDING', transactionRef: payment.transactionRef, amount: order.totalAmount }, data: { status: action === 'APPROVE' ? 'PAID' : 'FAILED', verifiedByUserId: req.user?.id, verifiedAt: new Date() } });
          if (!changedPayment.count) throw new Error('UPI_REVIEW_STATE_CONFLICT');
          if (action === 'APPROVE') await tx.transaction.create({ data: { paymentId: payment.id, type: 'PAYMENT', amount: order.totalAmount, status: 'SUCCESS', description: `Manual UPI receipt confirmed by shop operator for Order ${order.orderNumber}` } });
          return tx.order.findUnique({ where: { id: order.id }, include: { items: { include: { file: true } }, printJobs: { include: { printer: true } } } });
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'UPI_REVIEW_STATE_CONFLICT') return res.status(409).json({ success: false, message: 'Payment was already reviewed or the order changed. Refresh and try again.' });
        throw error;
      }
      if (!updatedOrder) return res.status(409).json({ success: false, message: 'Order could not be updated' });
      if (action === 'REJECT') {
        WebSocketService.broadcastOrderUpdate(order.orderNumber, order.shopId, updatedOrder);
        return res.status(200).json({ success: true, message: 'Payment marked as unverified. No refund was issued.', data: updatedOrder });
      }

      // 🚀 Dispatch print jobs directly to Windows Print Agent
      for (const job of updatedOrder.printJobs) {
        const item = updatedOrder.items.find((i) => i.id === job.orderItemId);
        if (item && item.file) {
          WebSocketService.dispatchPrintJob({
            id: job.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderItemId: item.id,
            shopId: order.shopId,
            printerId: job.printerId,
            fileUrl: `${getApiBaseUrl()}${item.file.url}`,
            fileName: item.file.originalName,
            mimeType: item.file.mimeType,
            settings: {
              colorMode: item.colorMode as any,
              paperSize: item.paperSize as any,
              orientation: item.orientation as any,
              duplexMode: item.duplexMode as any,
              copies: item.copies,
              pageRange: item.pageRange,
              pagesPerSheet: item.pagesPerSheet as any,
              quality: item.quality as any,
              selectedPagesCount: item.selectedPagesCount,
            },
            idempotencyKey: job.idempotencyKey,
            status: 'QUEUED',
            progressPercent: 0,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
            createdAt: job.createdAt.toISOString(),
          });
        }
      }

      WebSocketService.broadcastOrderUpdate(order.orderNumber, order.shopId, updatedOrder);

      return res.status(200).json({
        success: true,
        message: 'Direct UPI payment verified successfully! Print job dispatched to Windows spooler.',
        data: updatedOrder,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Validate and test custom UPI VPA
   */
  static async testUpiVpa(req: Request, res: Response, next: NextFunction) {
    try {
      const { upiVpa, displayName } = req.body;

      if (!upiVpa || typeof upiVpa !== 'string' || !isValidUpiVpa(upiVpa)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid UPI VPA (e.g. yourname@bank, shop@upi)' });
      }

      const vpa = upiVpa.trim();
      const name = displayName?.trim() || 'Print Shop';

      return res.status(200).json({
        success: true,
        message: 'UPI ID format validated. Ownership and payment receipt have not been verified.',
        data: {
          upiVpa: vpa,
          displayName: name,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin: Get platform payment gateways
   */
  static async getPlatformGateways(req: Request, res: Response, next: NextFunction) {
    try {
      const gateways = await prisma.paymentGatewayConfig.findMany({
        where: { shopId: null },
      });

      const result = gateways.map((g) => ({
        id: g.id,
        provider: g.provider,
        apiKey: g.apiKey || '',
        secretConfigured: Boolean(g.apiSecret),
        webhookSecretConfigured: Boolean(g.webhookSecret),
        merchantId: g.merchantId || '',
        upiVpa: g.upiVpa || '',
        isTestMode: g.isTestMode,
        isEnabled: g.isEnabled,
        status: g.isEnabled && (g.apiKey || g.upiVpa) ? 'CONFIGURED' : (g.apiKey || g.upiVpa ? 'INACTIVE' : 'NOT_CONFIGURED'),
        updatedAt: g.updatedAt,
      }));

      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin: Update platform payment gateway
   */
  static async updatePlatformGateway(req: Request, res: Response, next: NextFunction) {
    try {
      const { provider, apiKey, apiSecret, webhookSecret, merchantId, upiVpa, isTestMode, isEnabled } = req.body;
      const cleanProvider = String(provider).toUpperCase();
      if (!['UPI', 'RAZORPAY', 'CASHFREE', 'STRIPE'].includes(cleanProvider)) {
        return res.status(400).json({ success: false, message: 'Unsupported platform payment provider' });
      }

      const existing = await prisma.paymentGatewayConfig.findFirst({
        where: { shopId: null, provider: cleanProvider },
      });

      let cleanSecret = existing?.apiSecret || null;
      let cleanWebhook = existing?.webhookSecret || null;
      try {
        if (typeof apiSecret === 'string' && apiSecret && !apiSecret.includes('•')) cleanSecret = encryptPaymentCredential(apiSecret);
        if (typeof webhookSecret === 'string' && webhookSecret && !webhookSecret.includes('•')) cleanWebhook = encryptPaymentCredential(webhookSecret);
      } catch (error) {
        return res.status(503).json({ success: false, message: error instanceof Error ? error.message : 'Payment credential encryption is not configured' });
      }

      let gateway;
      if (existing) {
        gateway = await prisma.paymentGatewayConfig.update({
          where: { id: existing.id },
          data: {
            apiKey: apiKey !== undefined ? apiKey : existing.apiKey,
            apiSecret: cleanSecret,
            webhookSecret: cleanWebhook,
            merchantId: merchantId !== undefined ? merchantId : existing.merchantId,
            upiVpa: upiVpa !== undefined ? upiVpa : existing.upiVpa,
            isTestMode: typeof isTestMode === 'boolean' ? isTestMode : existing.isTestMode,
            isEnabled: typeof isEnabled === 'boolean' ? isEnabled : existing.isEnabled,
          },
        });
      } else {
        gateway = await prisma.paymentGatewayConfig.create({
          data: {
            shopId: null,
            provider: cleanProvider,
            apiKey: apiKey || null,
            apiSecret: cleanSecret || null,
            webhookSecret: cleanWebhook || null,
            merchantId: merchantId || null,
            upiVpa: upiVpa || null,
            isTestMode: typeof isTestMode === 'boolean' ? isTestMode : true,
            isEnabled: typeof isEnabled === 'boolean' ? isEnabled : true,
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: `Platform ${cleanProvider} gateway updated successfully`,
        data: {
          id: gateway.id,
          provider: gateway.provider,
          apiKey: gateway.apiKey || '',
          secretConfigured: Boolean(gateway.apiSecret),
          webhookSecretConfigured: Boolean(gateway.webhookSecret),
          merchantId: gateway.merchantId || '',
          upiVpa: gateway.upiVpa || '',
          isTestMode: gateway.isTestMode,
          isEnabled: gateway.isEnabled,
          updatedAt: gateway.updatedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

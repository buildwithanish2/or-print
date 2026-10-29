import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { QRCodeService } from '../services/qr.service';
import { WebSocketService } from '../services/socket.service';
import { EmailService } from '../services/email.service';
import { DEFAULT_PLATFORM_PRICING_RULES, getCustomerWebUrl } from '@printqr/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PaymentGatewayService } from '../services/payment.service';
import { ShopRegistrationSchema } from '@printqr/validation';

export class ShopController {
  /**
   * Public endpoint for customer QR landing
   */
  static async getShopBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;

      const shop = await prisma.shop.findFirst({
        where: {
          OR: [
            { slug: slug.toLowerCase() },
            { id: slug },
            { qrCodes: { some: { code: slug } } },
          ],
        },
        include: {
          services: { where: { isEnabled: true } },
          pricingRules: true,
          printers: {
            where: { status: 'ONLINE' },
            orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
            select: { id: true, name: true, isDefault: true, supportsColor: true, supportsDuplex: true, supportedSizes: true },
          },
          qrCodes: { where: { isActive: true } },
        },
      });

      if (!shop || shop.status !== 'ACTIVE') {
        return res.status(404).json({
          success: false,
          message: 'Printing shop not found or is currently unavailable',
        });
      }

      const selectedPrinter = shop.printers.find((printer) => printer.isDefault) || shop.printers[0];
      const capabilities = selectedPrinter ? {
        printerName: selectedPrinter.name,
        supportsColor: selectedPrinter.supportsColor,
        supportsDuplex: selectedPrinter.supportsDuplex,
        supportedSizes: selectedPrinter.supportedSizes.split(',').map((size) => size.trim()).filter(Boolean),
      } : null;

      return res.status(200).json({
        success: true,
        data: {
          id: shop.id,
          name: shop.name,
          slug: shop.slug,
          phone: shop.phone,
          email: shop.email,
          address: shop.address,
          city: shop.city,
          state: shop.state,
          pin: shop.pin,
          logoUrl: shop.logoUrl,
          bannerUrl: shop.bannerUrl,
          isOnline: shop.isOnline && Boolean(selectedPrinter),
          startingPrice: shop.startingPrice,
          services: shop.services,
          printersCount: shop.printers.length,
          printerCapabilities: capabilities,
          pricingRules: shop.pricingRules,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Shop Self-Registration Flow with SaaS Plan & Instant Activation (/shop/register)
   */
  static async registerShop(req: Request, res: Response, next: NextFunction) {
    try {
      if (!EmailService.isConfigured()) return res.status(503).json({ success: false, code: 'EMAIL_DELIVERY_UNAVAILABLE', message: 'Shop registration is unavailable until email verification delivery is configured.' });
      const parsedRegistration = ShopRegistrationSchema.safeParse(req.body);
      if (!parsedRegistration.success) {
        return res.status(400).json({ success: false, message: parsedRegistration.error.issues[0]?.message || 'Check your shop registration details' });
      }
      const {
        shopName,
        ownerName,
        email,
        phone,
        password,
        address,
        city,
        state,
        pin,
        gst,
        planId,
        planSlug,
        subscriptionPaymentAttemptId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        printerModel,
        printerConnectionType,
      } = parsedRegistration.data;

      if (!shopName || !ownerName || !email || !password || !phone) {
        return res.status(400).json({ success: false, message: 'All required fields must be filled' });
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
      }

      // A plan is always selected explicitly; never silently substitute another price.
      let targetPlan = null;
      if (planId) {
        targetPlan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
      }
      if (!targetPlan && planSlug) {
        targetPlan = await prisma.subscriptionPlan.findFirst({ where: { name: { contains: planSlug } } });
      }
      if (!targetPlan) return res.status(400).json({ success: false, message: 'A valid subscription plan is required' });

      const planName = targetPlan.name;
      const planPrice = targetPlan.priceMonthly;
      let verifiedAttemptId: string | null = null;
      let verifiedPaymentId: string | null = null;
      if (planPrice > 0) {
        if (![subscriptionPaymentAttemptId, razorpayOrderId, razorpayPaymentId, razorpaySignature].every((value) => typeof value === 'string' && value.length > 0)) {
          return res.status(402).json({ success: false, message: 'A verified Razorpay subscription payment is required for this plan' });
        }
        try {
          const verified = await PaymentGatewayService.verifySubscriptionPayment(subscriptionPaymentAttemptId!, razorpayOrderId!, razorpayPaymentId!, razorpaySignature!);
          if (verified.attempt.planId !== targetPlan.id || verified.attempt.amountPaise !== Math.round(targetPlan.priceMonthly * 100)) {
            return res.status(409).json({ success: false, message: 'Payment amount or selected plan does not match' });
          }
          verifiedAttemptId = verified.attempt.id;
          verifiedPaymentId = verified.payment.id;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Subscription payment verification failed';
          return res.status(/not configured/i.test(message) ? 503 : 402).json({ success: false, message });
        }
      } else if (subscriptionPaymentAttemptId || razorpayOrderId || razorpayPaymentId || razorpaySignature) {
        return res.status(400).json({ success: false, message: 'Free plans do not accept payment references' });
      }
      if (planPrice < 0) return res.status(400).json({ success: false, message: 'Subscription plan price is invalid' });

      // Generate clean unique slug
      let baseSlug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      if (!baseSlug) baseSlug = 'print-shop';
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.shop.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      // Create in Transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create User
        const user = await tx.user.create({
          data: {
            name: ownerName,
            email: email.toLowerCase(),
            phone: phone || null,
            passwordHash,
            role: 'SHOP_OWNER',
            emailVerificationRequired: true,
          },
        });

        // 2. Create Shop
        const shop = await tx.shop.create({
          data: {
            name: shopName,
            slug,
            ownerId: user.id,
            email: email.toLowerCase(),
            phone,
            address: address || 'Main Market Road',
            city: city || 'Bengaluru',
            state: state || 'Karnataka',
            pin: pin || '560001',
            gst: gst || null,
            status: 'PENDING_CONTACT_VERIFICATION',
            isOnline: true,
            startingPrice: 2.0,
          },
        });

        // Link the selected plan to the newly created shop. Paid plans are
        // claimed atomically so duplicate callbacks cannot register twice.
        if (verifiedAttemptId && verifiedPaymentId) {
          const claimed = await tx.subscriptionPaymentAttempt.updateMany({
            where: {
              id: verifiedAttemptId,
              planId: targetPlan.id,
              OR: [
                { status: 'PENDING', gatewayPaymentId: null, expiresAt: { gt: new Date() } },
                { status: 'PAID', gatewayPaymentId: verifiedPaymentId },
              ],
            },
            data: { status: 'CONSUMED', gatewayPaymentId: verifiedPaymentId, shopId: shop.id },
          });
          if (!claimed.count) throw new Error('SUBSCRIPTION_PAYMENT_ALREADY_USED');
        }
        const periodStart = new Date();
        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        await tx.shopSubscription.create({
          data: {
            shopId: shop.id,
            planId: targetPlan.id,
            status: 'ACTIVE',
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
          },
        });

        // 3. Generate QR Code
        const targetUrl = `${getCustomerWebUrl()}/print/${slug}`;
        const qrDataUrl = await QRCodeService.generateDataUrl(targetUrl);

        const qrCodeRecord = await tx.qRCodeRecord.create({
          data: {
            shopId: shop.id,
            code: `QR-${slug.toUpperCase()}`,
            targetUrl,
            label: `${shopName} Counter QR`,
            qrDataUrl,
            isActive: false,
          },
        });

        // 4. Create Initial Default Pricing Rules
        for (const rule of DEFAULT_PLATFORM_PRICING_RULES) {
          await tx.pricingRule.create({
            data: {
              shopId: shop.id,
              paperSize: rule.paperSize,
              colorMode: rule.colorMode,
              singleSidePrice: rule.singleSidePrice,
              duplexPrice: rule.duplexPrice,
              duplexDiscountPercent: rule.duplexDiscountPercent,
              bulkMinPages: rule.bulkMinPages,
              bulkDiscountPercent: rule.bulkDiscountPercent,
              isDefault: true,
            },
          });
        }

        // 5. Create Initial Printer
        const defaultPrinterName = printerModel || 'Primary Windows Printer';
        const printer = await tx.printer.create({
          data: {
            shopId: shop.id,
            name: defaultPrinterName,
            model: defaultPrinterName,
            connectionType: printerConnectionType || 'USB',
            status: 'ONLINE',
            isDefault: true,
            supportsColor: true,
            supportsDuplex: true,
          },
        });

        // 6. Generate 10-minute secure pairing code: ANP-XXXX-XXXX
        const randCode1 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const randCode2 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const pairingCode = `ANP-${randCode1}-${randCode2}`;
        const agentToken = `agent_tok_${crypto.randomBytes(16).toString('hex')}`;

        const agent = await tx.printerAgent.create({
          data: {
            shopId: shop.id,
            pairingCode,
            agentToken,
            deviceName: 'Windows Print Station',
            status: 'DISCONNECTED',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 mins
          },
        });

        return { user, shop, qrCodeRecord, printer, agent };
      });

      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await prisma.authActionToken.create({ data: {
        userId: result.user.id,
        purpose: 'EMAIL_VERIFY',
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      } });
      let emailSent = false;
      try {
        emailSent = await EmailService.sendActionLink(result.user.email,
          `${getCustomerWebUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`, 'verify');
      } catch {
        await prisma.authActionToken.updateMany({ where: { tokenHash, usedAt: null }, data: { usedAt: new Date() } });
      }

      return res.status(201).json({
        success: true,
        message: emailSent ? 'Shop registration received. Verify your email to activate shop access.' : 'Registration is pending email verification. Email delivery needs attention; request a new verification link later.',
        data: {
          user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            role: result.user.role,
          },
          shop: { id: result.shop.id, name: result.shop.name, status: result.shop.status, planName, planPrice },
          email: result.user.email,
          emailSent,
        },
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'SUBSCRIPTION_PAYMENT_ALREADY_USED') {
        return res.status(409).json({ success: false, message: 'This subscription payment was already used. Contact support if you were charged.' });
      }
      next(err);
    }
  }

  /**
   * Resend Welcome Email with Pairing PIN
   */
  static async resendWelcomeEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { shopId } = req.params;

      const shop = await prisma.shop.findFirst({
        where: { OR: [{ id: shopId }, { slug: shopId }] },
        include: {
          owner: true,
          agents: { orderBy: { createdAt: 'desc' }, take: 1 },
          qrCodes: { take: 1 },
        },
      });

      if (!shop || !shop.owner) {
        return res.status(404).json({ success: false, message: 'Shop not found' });
      }

      if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user?.role || '') && req.user?.shopId !== shop.id) {
        return res.status(404).json({ success: false, message: 'Shop not found' });
      }

      const pairingCode = shop.agents[0]?.pairingCode;
      if (!pairingCode) return res.status(404).json({ success: false, message: 'No active print-agent pairing code exists for this shop' });
      const customerUrl = shop.qrCodes[0]?.targetUrl || `${getCustomerWebUrl()}/print/${shop.slug}`;

      const emailResult = await EmailService.sendWelcomeEmail({
        to: shop.owner.email, ownerName: shop.owner.name, shopName: shop.name,
        planName: 'Starter Plan', shopId: `ANP-SHOP-${shop.id.substring(0, 6).toUpperCase()}`,
        pairingCode, customerUrl,
      });

      return res.status(200).json({
        success: true,
        message: emailResult.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Shop Dashboard metrics & analytics overview
   */
  static async getDashboardMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = req.user?.shopId || req.params.shopId;
      if (!shopId) {
        return res.status(400).json({ success: false, message: 'Shop ID required' });
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        todayOrders,
        pendingJobsCount,
        completedJobsCount,
        failedJobsCount,
        activePrintersCount,
        recentOrders,
        allShopOrders,
      ] = await Promise.all([
        prisma.order.findMany({
          where: { shopId, createdAt: { gte: todayStart } },
        }),
        prisma.printJob.count({
          where: { shopId, status: { in: ['QUEUED', 'PROCESSING', 'PRINTING'] } },
        }),
        prisma.printJob.count({
          where: { shopId, status: 'COMPLETED' },
        }),
        prisma.printJob.count({
          where: { shopId, status: 'FAILED' },
        }),
        prisma.printer.count({
          where: { shopId, status: 'ONLINE' },
        }),
        prisma.order.findMany({
          where: { shopId },
          orderBy: { createdAt: 'desc' },
          take: 6,
          include: { items: true, printJobs: true },
        }),
        prisma.order.findMany({
          where: { shopId },
          select: { totalAmount: true, createdAt: true, paymentStatus: true, items: { select: { colorMode: true, paperSize: true, calculatedPrice: true } } },
        }),
      ]);

      const todayRevenue = todayOrders
        .filter((o) => o.paymentStatus === 'PAID' || o.paymentStatus === 'CASH_ON_COUNTER')
        .reduce((sum, o) => sum + o.totalAmount, 0);

      const totalRevenue = allShopOrders
        .filter((o) => o.paymentStatus === 'PAID' || o.paymentStatus === 'CASH_ON_COUNTER')
        .reduce((sum, o) => sum + o.totalAmount, 0);

      // Aggregate chart data (last 7 days)
      const last7DaysMap = new Map<string, { date: string; revenue: number; orders: number }>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        last7DaysMap.set(key, { date: key, revenue: 0, orders: 0 });
      }

      allShopOrders.forEach((o) => {
        const key = new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (last7DaysMap.has(key)) {
          const entry = last7DaysMap.get(key)!;
          entry.orders += 1;
          if (o.paymentStatus === 'PAID' || o.paymentStatus === 'CASH_ON_COUNTER') {
            entry.revenue += o.totalAmount;
          }
        }
      });

      // Aggregate print types (Color vs BW)
      let bwCount = 0;
      let colorCount = 0;
      allShopOrders.forEach((o) => {
        o.items.forEach((item) => {
          if (item.colorMode === 'COLOR') colorCount++;
          else bwCount++;
        });
      });

      return res.status(200).json({
        success: true,
        data: {
          todayRevenue: Number(todayRevenue.toFixed(2)),
          totalRevenue: Number(totalRevenue.toFixed(2)),
          todayOrdersCount: todayOrders.length,
          totalOrdersCount: allShopOrders.length,
          pendingJobsCount,
          completedJobsCount,
          failedJobsCount,
          activePrintersCount,
          recentOrders,
          charts: {
            revenueTrend: Array.from(last7DaysMap.values()),
            printTypeDistribution: [
              { name: 'Black & White', value: Math.max(1, bwCount) },
              { name: 'Color', value: Math.max(1, colorCount) },
            ],
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Generates a 10-minute temporary secure pairing code (ANP-XXXX-XXXX)
   */
  static async generatePairingCode(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) return res.status(400).json({ success: false, message: 'Shop ID required' });

      // Generate format: ANP-8F4K-29QX
      const rand1 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const rand2 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const pairingCode = `ANP-${rand1}-${rand2}`;
      const agentToken = `agent_tok_${crypto.randomBytes(16).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const agent = await prisma.printerAgent.create({
        data: {
          shopId,
          pairingCode,
          agentToken,
          deviceName: 'Pending Windows Agent',
          status: 'DISCONNECTED',
          expiresAt,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Pairing code generated successfully',
        data: {
          pairingCode: agent.pairingCode,
          agentToken: agent.agentToken,
          expiresAt: expiresAt.toISOString(),
          expiresInMinutes: 10,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Regenerates a fresh QR code for the shop (Explicit Shop Owner Action)
   */
  static async regenerateQRCode(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) return res.status(400).json({ success: false, message: 'Shop ID required' });

      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

      const qrToken = `ANP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const targetUrl = `${getCustomerWebUrl()}/print/${shop.slug}`;
      const qrDataUrl = await QRCodeService.generateDataUrl(targetUrl);
      const qrSvg = await QRCodeService.generateSvg(targetUrl);

      const existingQR = await prisma.qRCodeRecord.findFirst({ where: { shopId } });
      let qrRecord;
      if (existingQR) {
        qrRecord = await prisma.qRCodeRecord.update({
          where: { id: existingQR.id },
          data: { code: qrToken, qrDataUrl, targetUrl, updatedAt: new Date() },
        });
      } else {
        qrRecord = await prisma.qRCodeRecord.create({
          data: {
            shopId: shop.id,
            code: qrToken,
            targetUrl,
            qrDataUrl,
            isActive: true,
          },
        });
      }

      // Broadcast live update to customer web
      WebSocketService.broadcastShopUpdate(shop.slug, { qrCode: qrRecord, isEnabled: true });

      return res.status(200).json({
        success: true,
        message: 'QR Code updated successfully',
        data: {
          ...qrRecord,
          qrSvg,
          shopName: shop.name,
          slug: shop.slug,
          startingPrice: shop.startingPrice,
          isEnabled: qrRecord.isActive,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Toggles QR Code active status
   */
  static async toggleQRCodeStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) return res.status(400).json({ success: false, message: 'Shop ID required' });

      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

      const { isActive } = req.body;
      const qr = await prisma.qRCodeRecord.findFirst({ where: { shopId: String(shopId) } });
      if (!qr) return res.status(404).json({ success: false, message: 'QR record not found' });

      const updated = await prisma.qRCodeRecord.update({
        where: { id: qr.id },
        data: { isActive: typeof isActive === 'boolean' ? isActive : !qr.isActive },
      });

      // Broadcast live status to connected customers
      WebSocketService.broadcastShopUpdate(shop.slug, { isEnabled: updated.isActive });

      return res.status(200).json({
        success: true,
        message: `QR code ${updated.isActive ? 'enabled' : 'disabled'} successfully`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Shop QR Code and printable flyer metadata (Cached & Permanent)
   */
  static async getShopQR(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = req.user?.shopId || req.params.slug;
      if (!shopId || shopId === 'me') {
        return res.status(400).json({ success: false, message: 'Shop ID or valid slug required' });
      }

      const shop = await prisma.shop.findFirst({
        where: {
          OR: [{ id: shopId }, { slug: shopId }],
        },
        include: { qrCodes: true },
      });

      if (!shop || shop.status !== 'ACTIVE') return res.status(404).json({ success: false, message: 'Shop not found' });

      let qrRecord = shop.qrCodes?.[0];
      const targetUrl = `${getCustomerWebUrl()}/print/${shop.slug}`;
      
      let qrDataUrl = qrRecord?.qrDataUrl;
      if (!qrDataUrl) {
        qrDataUrl = await QRCodeService.generateDataUrl(targetUrl);
        if (!qrRecord) {
          qrRecord = await prisma.qRCodeRecord.create({
            data: {
              shopId: shop.id,
              code: `ANP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
              targetUrl,
              qrDataUrl,
              isActive: true,
            },
          });
        } else {
          qrRecord = await prisma.qRCodeRecord.update({
            where: { id: qrRecord.id },
            data: { qrDataUrl, targetUrl },
          });
        }
      }

      const qrSvg = await QRCodeService.generateSvg(targetUrl);
      const isEnabled = qrRecord ? qrRecord.isActive : true;

      return res.status(200).json({
        success: true,
        data: {
          shopName: shop.name,
          slug: shop.slug,
          logoUrl: shop.logoUrl,
          bannerUrl: shop.bannerUrl,
          phone: shop.phone,
          address: shop.address,
          city: shop.city,
          targetUrl,
          qrDataUrl,
          qrSvg,
          startingPrice: shop.startingPrice,
          isEnabled,
          flyerTitle: 'Scan to Print from Mobile',
          flyerSubtitle: 'Fast, Contactless & Instant Printout Pickup',
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update Shop Profile & Branding
   */
  static async updateShopBranding(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) return res.status(400).json({ success: false, message: 'Shop ID required' });

      const { name, logoUrl, bannerUrl, startingPrice, phone, address, city } = req.body;

      const updated = await prisma.shop.update({
        where: { id: shopId },
        data: {
          name: name || undefined,
          logoUrl: logoUrl !== undefined ? logoUrl : undefined,
          bannerUrl: bannerUrl !== undefined ? bannerUrl : undefined,
          startingPrice: startingPrice !== undefined ? Number(startingPrice) : undefined,
          phone: phone || undefined,
          address: address || undefined,
          city: city || undefined,
        },
      });

      // Live WebSocket broadcast to all connected mobile customers
      WebSocketService.broadcastShopUpdate(updated.slug, updated);

      return res.status(200).json({
        success: true,
        message: 'Shop profile & branding updated successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
}

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { CreateOrderSchema } from '@printqr/validation';
import { PricingEngineService } from '../services/pricing.service';
import { canCollectCashPayment, decryptPaymentCredential, PaymentGatewayService } from '../services/payment.service';
import { WebSocketService } from '../services/socket.service';
import { getApiBaseUrl } from '@printqr/config';
import crypto from 'crypto';
import { FreePrintEligibilityError, getFreePrintEligibility, getGuestFreePrintEligibility, getGuestVerificationByToken, reserveFreePrintAllowance } from '../services/free-print.service';
import { canManageShopPayment } from '../services/payment.service';

export class OrderController {
  /**
   * Customer places a new print order
   */
  static async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = CreateOrderSchema.parse(req.body);
      const isCollegeFreePrint = data.freePrintRequested === true;
      const guestFreePrintToken = String(req.get('X-Free-Print-Token') || '');
      const guestVerification = isCollegeFreePrint && guestFreePrintToken ? await getGuestVerificationByToken(guestFreePrintToken) : null;
      const idempotencyHash = data.idempotencyKey
        ? crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
        : null;
      if (data.idempotencyKey) {
        const existingOrder = await prisma.order.findUnique({ where: { idempotencyKey: data.idempotencyKey }, include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } } });
        if (existingOrder) {
          if (existingOrder.idempotencyHash !== idempotencyHash) return res.status(409).json({ success: false, message: 'This checkout request key was already used for a different order' });
          return res.status(200).json({ success: true, message: 'Order was already created', data: { orderNumber: existingOrder.orderNumber, trackingUrl: `/track/${encodeURIComponent(existingOrder.orderNumber)}?token=${encodeURIComponent(existingOrder.trackingToken)}`, trackingToken: existingOrder.trackingToken, totalAmount: existingOrder.totalAmount, payment: { paymentId: existingOrder.payments[0]?.id || '', gateway: existingOrder.payments[0]?.gateway || existingOrder.paymentMethod, status: existingOrder.payments[0]?.status || existingOrder.paymentStatus } } });
        }
      }

      const shop = await prisma.shop.findUnique({
        where: { slug: data.shopSlug },
        include: { printers: { where: { status: 'ONLINE' }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] } },
      });

      if (!shop) {
        return res.status(404).json({ success: false, message: 'Shop not found' });
      }
      if (shop.status !== 'ACTIVE') {
        return res.status(409).json({ success: false, message: 'This shop is not active for customer orders yet' });
      }
      if (!shop.isOnline || shop.printers.length === 0) {
        return res.status(409).json({ success: false, message: 'This shop is not accepting print orders right now' });
      }

      if (!isCollegeFreePrint && data.paymentMethod.startsWith('RAZORPAY')) {
        const merchant = await prisma.paymentGatewayConfig.findFirst({ where: { shopId: shop.id, provider: 'RAZORPAY', isEnabled: true } });
        if (!merchant?.apiKey || !decryptPaymentCredential(merchant.apiSecret)) {
          return res.status(409).json({ success: false, message: 'This shop has not connected its own Razorpay account' });
        }
      }

      let upiVpa: string | undefined;
      if (!isCollegeFreePrint && data.paymentMethod === 'UPI') {
        const shopUpi = await prisma.paymentGatewayConfig.findFirst({ where: { shopId: shop.id, provider: 'UPI', isEnabled: true } });
        upiVpa = shopUpi?.upiVpa || undefined;
        if (!upiVpa) return res.status(409).json({ success: false, message: 'UPI payment is not configured for this shop' });
      }

      const chosenPrinter = shop.printers.find((printer) => printer.isDefault) || shop.printers[0];
      for (const item of data.items) {
        if (item.settings.colorMode === 'COLOR' && !chosenPrinter.supportsColor) {
          return res.status(400).json({ success: false, message: 'The selected printer does not support color printing' });
        }
        if (item.settings.duplexMode !== 'SIMPLEX' && !chosenPrinter.supportsDuplex) {
          return res.status(400).json({ success: false, message: 'The selected printer does not support duplex printing' });
        }
        const supportedSizes = chosenPrinter.supportedSizes.split(',').map((size) => size.trim().toUpperCase()).filter(Boolean);
        if (supportedSizes.length && !supportedSizes.includes(item.settings.paperSize.toUpperCase())) {
          return res.status(400).json({ success: false, message: `The selected printer does not support ${item.settings.paperSize} paper` });
        }
      }

      // Calculate items and totals server-side
      const itemBreakdowns: any[] = [];
      for (const item of data.items) {
        const file = await prisma.fileRecord.findUnique({ where: { id: item.fileId } });
        if (!file || file.expiresAt <= new Date() || (file.shopId && file.shopId !== shop.id)) {
          return res.status(400).json({ success: false, message: `File ${item.fileId} not found` });
        }
        if (isCollegeFreePrint) {
          if (guestVerification && guestVerification.shopId === shop.id && file.guestVerificationId === guestVerification.id) {
            // The account-free photo review token is bound to this file session.
          } else if (req.user) {
            const owners = await prisma.$queryRaw<Array<{ userId: string }>>`SELECT "userId" FROM "FileOwnership" WHERE "fileId" = ${file.id} LIMIT 1`;
            if (owners[0]?.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Free-print orders can only use documents uploaded from your account.' });
          } else if (!guestVerification || guestVerification.shopId !== shop.id || file.guestVerificationId !== guestVerification.id) {
            return res.status(403).json({ success: false, message: 'Free-print orders can only use documents uploaded in the same ID verification session.' });
          }
        }
        const pageRange = PricingEngineService.validatePageRange(item.settings.pageRange, file.pageCount);
        if (!pageRange.valid) return res.status(400).json({ success: false, message: pageRange.message });

        const breakdown = await PricingEngineService.calculateItemPrice(
          shop.id,
          file.id,
          file.originalName,
          file.pageCount,
          item.settings as any
        );
        itemBreakdowns.push({ ...breakdown, settings: item.settings });
      }

      const pricing = await PricingEngineService.calculateOrderTotal(
        itemBreakdowns,
        data.couponCode,
        shop.id
      );

      let freeEligibility: (Awaited<ReturnType<typeof getFreePrintEligibility>> | Awaited<ReturnType<typeof getGuestFreePrintEligibility>>) | null = null;
      if (isCollegeFreePrint) {
        try {
          if (req.user && ['STUDENT', 'TEACHER'].includes(req.user.role)) freeEligibility = await getFreePrintEligibility(req.user.id, shop.id, itemBreakdowns.map((item) => item.settings.colorMode));
          else if (guestFreePrintToken) freeEligibility = await getGuestFreePrintEligibility(guestFreePrintToken, shop.id, itemBreakdowns.map((item) => item.settings.colorMode));
          else return res.status(403).json({ success: false, code: 'NOT_VERIFIED', message: 'Upload your college ID and wait for shop approval to request free printing.' });
        } catch (error) {
          if (error instanceof FreePrintEligibilityError) return res.status(403).json({ success: false, code: error.code, message: error.message });
          throw error;
        }
        const requestedPages = itemBreakdowns.reduce((sum, item) => sum + item.selectedPages * item.copies, 0);
        const requestedCopies = itemBreakdowns.reduce((sum, item) => sum + item.copies, 0);
        const role = freeEligibility.role;
        if (requestedPages > freeEligibility.remainingDailyPages || requestedPages > freeEligibility.remainingMonthlyPages || requestedCopies > freeEligibility.remainingDailyCopies || requestedCopies > freeEligibility.remainingMonthlyCopies) {
          return res.status(409).json({ success: false, code: 'FREE_LIMIT_EXCEEDED', message: 'This request exceeds your remaining daily or monthly free-print allowance. You can switch to regular paid printing or reduce pages/copies.', data: { remainingDailyPages: freeEligibility.remainingDailyPages, remainingMonthlyPages: freeEligibility.remainingMonthlyPages, remainingDailyCopies: freeEligibility.remainingDailyCopies, remainingMonthlyCopies: freeEligibility.remainingMonthlyCopies } });
        }
      }

      // Generate unique human-readable Order Number (ANP-XXXXXX)
      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      const orderNumber = `ANP-${randomDigits}`;
      const trackingToken = `trk_${crypto.randomBytes(32).toString('hex')}`;

      const totalPagesSum = itemBreakdowns.reduce((sum, i) => sum + i.selectedPages * i.copies, 0);
      const totalCopiesSum = itemBreakdowns.reduce((sum, i) => sum + i.copies, 0);

      const isCounterPay = !isCollegeFreePrint && data.paymentMethod === 'PAY_AT_COUNTER';
      const cashConfig = isCounterPay
        ? await prisma.paymentGatewayConfig.findFirst({ where: { shopId: shop.id, provider: 'PAY_AT_COUNTER' } })
        : null;
      if (cashConfig && !cashConfig.isEnabled) {
        return res.status(409).json({ success: false, message: 'This shop is not accepting cash payments right now' });
      }

      // Create Order and OrderItems in database transaction
      let cashPaymentId = '';
      const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            shopId: shop.id,
            idempotencyKey: data.idempotencyKey,
            idempotencyHash,
            customerName: data.customerName || 'Walk-in Customer',
            customerPhone: data.customerPhone || null,
            customerEmail: data.customerEmail || null,
            totalPages: totalPagesSum,
            totalCopies: totalCopiesSum,
            subtotal: isCollegeFreePrint ? 0 : pricing.subtotal,
            taxAmount: isCollegeFreePrint ? 0 : pricing.gstAmount,
            discountAmount: isCollegeFreePrint ? 0 : pricing.totalDiscount,
            serviceFee: isCollegeFreePrint ? 0 : pricing.serviceFee,
            totalAmount: isCollegeFreePrint ? 0 : pricing.finalTotal,
            paymentMethod: isCollegeFreePrint ? 'COLLEGE_FREE' : data.paymentMethod,
            paymentStatus: isCollegeFreePrint ? 'NOT_REQUIRED' : isCounterPay ? 'CASH_ON_COUNTER' : 'PENDING',
            printStatus: isCollegeFreePrint || isCounterPay ? 'QUEUED' : 'RECEIVED',
            trackingToken,
            couponCode: data.couponCode || null,
            notes: data.notes || null,
          },
        });

        for (const item of itemBreakdowns) {
          const orderItem = await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              fileId: item.fileId,
              colorMode: item.settings.colorMode,
              paperSize: item.settings.paperSize,
              orientation: item.settings.orientation,
              duplexMode: item.settings.duplexMode,
              copies: item.settings.copies,
              pageRange: item.settings.pageRange,
              pagesPerSheet: item.settings.pagesPerSheet,
              quality: item.settings.quality,
              selectedPagesCount: item.selectedPages,
              calculatedPrice: isCollegeFreePrint ? 0 : item.itemTotal,
            },
          });

          // Choose printer (prefer default online printer or first available)
          if (chosenPrinter) {
            await tx.printJob.create({
              data: {
                orderId: newOrder.id,
                orderItemId: orderItem.id,
                printerId: chosenPrinter.id,
                shopId: shop.id,
                idempotencyKey: `job_${orderNumber}_${orderItem.id}`,
                status: 'QUEUED',
                progressPercent: 0,
              },
            });
          }
        }

        // Cash is an uncollected payment at order creation. Record it with the
        // order atomically and without a fabricated gateway transaction ID.
        if (isCounterPay) {
          const cashPayment = await tx.payment.create({
            data: {
              orderId: newOrder.id,
              amount: newOrder.totalAmount,
              gateway: 'COUNTER_CASH',
              paymentMethod: 'PAY_AT_COUNTER',
              status: 'PENDING',
            },
          });
          cashPaymentId = cashPayment.id;
        }

        if (isCollegeFreePrint && freeEligibility) {
          await reserveFreePrintAllowance(tx, {
            orderId: newOrder.id, userId: 'identityHash' in freeEligibility ? null : req.user?.id || null,
            guestIdentityHash: 'identityHash' in freeEligibility ? freeEligibility.identityHash : null,
            guestVerificationId: 'verificationId' in freeEligibility ? freeEligibility.verificationId : null,
            pages: itemBreakdowns.reduce((sum, item) => sum + item.selectedPages * item.copies, 0),
            copies: itemBreakdowns.reduce((sum, item) => sum + item.copies, 0),
            dayKey: freeEligibility.dayKey, monthKey: freeEligibility.monthKey,
            policySnapshot: { policyId: freeEligibility.policy.id, institutionId: freeEligibility.institution.id, institutionName: freeEligibility.institution.name, role: freeEligibility.role },
            shopId: shop.id, printerId: chosenPrinter.id,
            options: itemBreakdowns.map((item) => ({ colorMode: item.settings.colorMode, duplexMode: item.settings.duplexMode, paperSize: item.settings.paperSize })),
          });
        }

        return newOrder;
      });

      // Initialize Payment
      const paymentInit = isCollegeFreePrint ? {
        gateway: 'COLLEGE_FREE', paymentId: '', amount: 0, currency: 'INR', status: 'NOT_REQUIRED',
      } : isCounterPay ? {
        gateway: 'COUNTER_CASH',
        paymentId: cashPaymentId,
        amount: order.totalAmount,
        currency: 'INR',
        status: 'PENDING',
      } : await PaymentGatewayService.initializeOrderPayment(
        order.id,
        order.orderNumber,
        order.totalAmount,
        data.paymentMethod,
        shop.name,
        upiVpa
      );

      if (isCollegeFreePrint) {
        const dispatchOrder = await prisma.order.findUnique({ where: { id: order.id }, include: { items: { include: { file: true } }, printJobs: true } });
        for (const job of dispatchOrder?.printJobs || []) {
          const item = dispatchOrder?.items.find((entry) => entry.id === job.orderItemId);
          if (item?.file) WebSocketService.dispatchPrintJob({
            id: job.id, orderId: order.id, orderNumber, orderItemId: item.id,
            shopId: shop.id, printerId: job.printerId, fileUrl: `${getApiBaseUrl()}${item.file.url}`,
            fileName: item.file.originalName, mimeType: item.file.mimeType,
            settings: { colorMode: item.colorMode as any, paperSize: item.paperSize as any, orientation: item.orientation as any, duplexMode: item.duplexMode as any, copies: item.copies, pageRange: item.pageRange, pagesPerSheet: item.pagesPerSheet as any, quality: item.quality as any, selectedPagesCount: item.selectedPagesCount },
            idempotencyKey: job.idempotencyKey, status: 'QUEUED', progressPercent: 0,
            attempts: job.attempts, maxAttempts: job.maxAttempts, createdAt: job.createdAt.toISOString(),
          });
        }
      }

      // If counter pay, immediately notify shop dashboard
      if (isCounterPay) {
        WebSocketService.broadcastOrderUpdate(order.orderNumber, shop.id, order);
      }

      return res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: {
          orderNumber: order.orderNumber,
          trackingUrl: `/track/${encodeURIComponent(order.orderNumber)}?token=${encodeURIComponent(order.trackingToken)}`,
          trackingToken: order.trackingToken,
          totalAmount: order.totalAmount,
          payment: paymentInit,
          freePrint: isCollegeFreePrint ? { eligible: true, status: 'RESERVED', requestedPages: totalPagesSum, institution: freeEligibility?.institution.name } : undefined,
        },
      });
    } catch (err) {
      const databaseError = err as { code?: string; meta?: { target?: unknown } };
      const target = String(databaseError?.meta?.target || '');
      const key = req.body?.idempotencyKey;
      if (databaseError?.code === 'P2002' && key && target.toLowerCase().includes('idempotencykey')) {
        const duplicate = await prisma.order.findUnique({ where: { idempotencyKey: String(key) }, include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } } });
        if (duplicate) {
          const hash = crypto.createHash('sha256').update(JSON.stringify(CreateOrderSchema.parse(req.body))).digest('hex');
          if (duplicate.idempotencyHash !== hash) return res.status(409).json({ success: false, message: 'This checkout request key was already used for a different order' });
          return res.status(200).json({ success: true, message: 'Order was already created', data: { orderNumber: duplicate.orderNumber, trackingUrl: `/track/${encodeURIComponent(duplicate.orderNumber)}?token=${encodeURIComponent(duplicate.trackingToken)}`, trackingToken: duplicate.trackingToken, totalAmount: duplicate.totalAmount, payment: { paymentId: duplicate.payments[0]?.id || '', gateway: duplicate.payments[0]?.gateway || duplicate.paymentMethod, status: duplicate.payments[0]?.status || duplicate.paymentStatus } } });
        }
      }
      if (err instanceof FreePrintEligibilityError) return res.status(409).json({ success: false, code: err.code, message: err.message });
      next(err);
    }
  }

  /**
   * Real-time order tracking for customer and receipt generator
   */
  static async getOrderByNumber(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderNumber } = req.params;
      const trackingToken = String(req.query.token || '');

      const order = await prisma.order.findUnique({
        where: { orderNumber },
        include: {
          shop: { select: { id: true, name: true, slug: true, phone: true, address: true, logoUrl: true } },
          items: { include: { file: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, pageCount: true, category: true } } } },
          printJobs: {
            include: { printer: { select: { name: true, model: true } } },
          },
          payments: { select: { id: true, amount: true, gateway: true, paymentMethod: true, status: true, transactionRef: true, createdAt: true, updatedAt: true } },
        },
      });

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      const expectedToken = Buffer.from(order.trackingToken);
      const providedToken = Buffer.from(trackingToken);
      if (expectedToken.length !== providedToken.length || !crypto.timingSafeEqual(expectedToken, providedToken)) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      return res.status(200).json({
        success: true,
        data: {
          ...order,
          trackingToken: undefined,
          guestSessionId: undefined,
          printJobs: order.printJobs.map(({ idempotencyKey, ...job }) => job),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Shop orders list with status filter and pagination
   */
  static async getShopOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const canViewAnyShop = ['SUPER_ADMIN', 'ADMIN'].includes(req.user?.role || '');
      const requestedShopId = typeof req.query.shopId === 'string' ? req.query.shopId : undefined;
      const shopId = canViewAnyShop ? (requestedShopId || req.user?.shopId) : req.user?.shopId;
      const { status, search } = req.query;

      if (!shopId) return res.status(400).json({ success: false, message: 'Shop ID required' });

      const where: any = { shopId };
      const statusFilter = typeof status === 'string' ? status.split(',').map((value) => value.trim()).filter(Boolean) : [];
      if (statusFilter.length === 1) where.printStatus = statusFilter[0];
      if (statusFilter.length > 1) where.printStatus = { in: statusFilter };
      if (search) {
        where.OR = [
          { orderNumber: { contains: String(search) } },
          { customerName: { contains: String(search) } },
          { customerPhone: { contains: String(search) } },
        ];
      }

      const pageNumber = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
      const limitNumber = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '20'), 10) || 20));
      const skip = (pageNumber - 1) * limitNumber;
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNumber,
          include: {
            items: { include: { file: true } },
            printJobs: { include: { printer: true } },
          },
        }),
        prisma.order.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: orders,
        meta: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages: Math.ceil(total / limitNumber),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Verify Payment / Mark as Paid at counter
   */
  static async markOrderAsPaid(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.params;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          shop: { include: { printers: true } },
          items: { include: { file: true } },
          printJobs: true,
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
      const managerShopId = req.user?.shopId || (req.user?.role === 'SHOP_OWNER' ? (await prisma.shop.findFirst({ where: { ownerId: req.user.id }, select: { id: true } }))?.id : undefined);
      if (!canManageShopPayment(req.user?.role || '', managerShopId, order.shopId)) {
        return res.status(403).json({ success: false, message: 'You are not authorized to manage this order' });
      }
      if (!canCollectCashPayment(order.paymentMethod, order.paymentStatus, order.printStatus)) {
        return res.status(409).json({ success: false, message: 'Only unpaid counter orders can be marked paid' });
      }

      // Update order and print jobs to QUEUED
      let updatedOrder;
      try {
        updatedOrder = await prisma.$transaction(async (tx) => {
          const changed = await tx.order.updateMany({
            where: { id: orderId, paymentStatus: 'CASH_ON_COUNTER', printStatus: 'QUEUED' },
            data: { paymentStatus: 'PAID', printStatus: 'QUEUED' },
          });
          if (!changed.count) return null;

          const payment = order.payments[0];
          let paymentId: string;
          if (payment) {
            const paid = await tx.payment.updateMany({
              where: { id: payment.id, status: 'PENDING', paymentMethod: 'PAY_AT_COUNTER' },
              data: { status: 'PAID', verifiedByUserId: req.user?.id, verifiedAt: new Date() },
            });
            if (!paid.count || payment.amount !== order.totalAmount) throw new Error('CASH_PAYMENT_STATE_CONFLICT');
            paymentId = payment.id;
          } else {
            // Preserve a correct audit record for older counter orders created
            // before cash payment rows were written atomically with the order.
            const legacyPayment = await tx.payment.create({
              data: {
                orderId,
                amount: order.totalAmount,
                gateway: 'COUNTER_CASH',
                paymentMethod: 'PAY_AT_COUNTER',
                status: 'PAID',
                verifiedByUserId: req.user?.id,
                verifiedAt: new Date(),
              },
            });
            paymentId = legacyPayment.id;
          }
          await tx.transaction.create({
            data: {
              paymentId,
              type: 'PAYMENT',
              amount: order.totalAmount,
              status: 'SUCCESS',
              description: `Cash collected by ${req.user?.id || 'authorized operator'} for Order ${order.orderNumber}`,
            },
          });
          return tx.order.findUnique({
            where: { id: orderId },
            include: { items: { include: { file: true } }, printJobs: { include: { printer: true } } },
          });
        });
      } catch (err) {
        if (err instanceof Error && err.message === 'CASH_PAYMENT_STATE_CONFLICT') {
          return res.status(409).json({ success: false, message: 'Cash payment state or amount changed; refresh the order before confirming collection' });
        }
        throw err;
      }
      if (!updatedOrder) {
        return res.status(409).json({ success: false, message: 'Order was already updated; refresh before retrying' });
      }

      // Dispatch jobs to Windows Agent via WebSocket
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
        message: 'Order marked as paid and sent to printer queue',
        data: updatedOrder,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retry failed print job
   */
  static async retryPrintJob(req: Request, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.params;
      const job = await prisma.printJob.findUnique({
        where: { id: jobId },
        include: {
          order: true,
          orderItem: { include: { file: true } },
        },
      });

      if (!job) return res.status(404).json({ success: false, message: 'Print job not found' });
      if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user?.role || '') && job.shopId !== req.user?.shopId) {
        return res.status(403).json({ success: false, message: 'You are not authorized to manage this print job' });
      }
      if (job.status !== 'FAILED' || job.attempts >= job.maxAttempts) {
        return res.status(409).json({ success: false, message: 'Only failed jobs with retries remaining can be retried' });
      }
      const freeReservation = await prisma.freePrintReservation.findUnique({ where: { orderId: job.orderId } });
      if (freeReservation && freeReservation.status !== 'RESERVED') {
        return res.status(409).json({ success: false, message: 'This free-print allowance was already reconciled. Create a new order so current eligibility and limits can be checked again.' });
      }

      const updatedJob = await prisma.printJob.update({
        where: { id: jobId },
        data: {
          status: 'QUEUED',
          progressPercent: 0,
          errorMessage: null,
          attempts: job.attempts + 1,
        },
      });

      if (job.orderItem && job.orderItem.file) {
        WebSocketService.dispatchPrintJob({
          id: updatedJob.id,
          orderId: job.order.id,
          orderNumber: job.order.orderNumber,
          orderItemId: job.orderItemId,
          shopId: job.shopId,
          printerId: job.printerId,
          fileUrl: `${getApiBaseUrl()}${job.orderItem.file.url}`,
          fileName: job.orderItem.file.originalName,
          mimeType: job.orderItem.file.mimeType,
          settings: {
            colorMode: job.orderItem.colorMode as any,
            paperSize: job.orderItem.paperSize as any,
            orientation: job.orderItem.orientation as any,
            duplexMode: job.orderItem.duplexMode as any,
            copies: job.orderItem.copies,
            pageRange: job.orderItem.pageRange,
            pagesPerSheet: job.orderItem.pagesPerSheet as any,
            quality: job.orderItem.quality as any,
            selectedPagesCount: job.orderItem.selectedPagesCount,
          },
          idempotencyKey: `${job.idempotencyKey}_retry_${Date.now()}`,
          status: 'QUEUED',
          progressPercent: 0,
          attempts: updatedJob.attempts,
          maxAttempts: updatedJob.maxAttempts,
          createdAt: updatedJob.createdAt.toISOString(),
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Print job retry queued',
        data: updatedJob,
      });
    } catch (err) {
      next(err);
    }
  }
}

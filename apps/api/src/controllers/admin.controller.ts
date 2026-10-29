import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { CouponSchema } from '@printqr/validation';
import { QRCodeService } from '../services/qr.service';
import { DEFAULT_PLATFORM_PRICING_RULES, getCustomerWebUrl } from '@printqr/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { JWT_SECRET } from '../config/secrets';

export class AdminController {
  /**
   * Super Admin SaaS Platform Overview KPIs
   */
  static async getPlatformMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const [
        totalShops,
        activeShops,
        totalOrders,
        totalRevenueAgg,
        onlinePrinters,
        connectedAgents,
        recentShops,
        recentOrders,
        auditLogs,
      ] = await Promise.all([
        prisma.shop.count(),
        prisma.shop.count({ where: { status: 'ACTIVE' } }),
        prisma.order.count(),
        prisma.order.aggregate({
          where: { paymentStatus: { in: ['PAID', 'CASH_ON_COUNTER'] } },
          _sum: { totalAmount: true },
        }),
        prisma.printer.count({ where: { status: 'ONLINE' } }),
        prisma.printerAgent.count({ where: { status: 'CONNECTED' } }),
        prisma.shop.findMany({
          take: 8,
          orderBy: { createdAt: 'desc' },
          include: {
            owner: { select: { name: true, email: true, phone: true } },
            agents: { select: { status: true, deviceName: true, lastHeartbeat: true } },
            printers: { select: { id: true, name: true, status: true } },
            _count: { select: { orders: true, printers: true } },
          },
        }),
        prisma.order.findMany({
          take: 8,
          orderBy: { createdAt: 'desc' },
          include: { shop: { select: { name: true, slug: true } } },
        }),
        prisma.auditLog.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, email: true, role: true } } },
        }),
      ]);

      const platformTotalRevenue = totalRevenueAgg._sum.totalAmount || 0;
      const estimatedMrr = activeShops * 799;

      return res.status(200).json({
        success: true,
        data: {
          metrics: {
            totalShops,
            activeShops,
            totalOrders,
            platformTotalRevenue: Number(platformTotalRevenue.toFixed(2)),
            estimatedMrr,
            onlinePrinters,
            connectedAgents,
          },
          recentShops,
          recentOrders,
          auditLogs,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin Manual Shop Creation (/admin/shops/create)
   */
  static async createShop(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        name,
        ownerName,
        email,
        phone,
        password,
        address,
        city,
        state,
        pin,
        gst,
        logoUrl,
        planName,
        status = 'ACTIVE',
      } = req.body;

      if (!name || !ownerName || !email || !password || !phone) {
        return res.status(400).json({ success: false, message: 'All required shop and owner fields must be provided' });
      }
      if (String(password).length < 12) return res.status(400).json({ success: false, message: 'Shop owner passwords must contain at least 12 characters' });

      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        return res.status(409).json({ success: false, message: 'A user account with this email already exists' });
      }

      // Generate unique slug
      let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      if (!baseSlug) baseSlug = 'print-center';
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.shop.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const result = await prisma.$transaction(async (tx) => {
        // 1. Create Owner User
        const user = await tx.user.create({
          data: {
            name: ownerName,
            email: email.toLowerCase(),
            phone: phone || null,
            passwordHash,
            role: 'SHOP_OWNER',
          },
        });

        // 2. Create Shop
        const shop = await tx.shop.create({
          data: {
            name,
            slug,
            ownerId: user.id,
            email: email.toLowerCase(),
            phone,
            address: address || 'Main Market Road',
            city: city || 'Bengaluru',
            state: state || 'Karnataka',
            pin: pin || '560001',
            gst: gst || null,
            logoUrl: logoUrl || null,
            status,
            isOnline: true,
            startingPrice: 2.0,
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
            label: `${name} Counter QR`,
            qrDataUrl,
            isActive: true,
          },
        });

        // 4. Create Default Pricing Rules
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

        // 5. Create Default Online Printer
        await tx.printer.create({
          data: {
            shopId: shop.id,
            name: 'HP LaserJet Pro (Standard)',
            model: 'HP LaserJet Pro Series',
            connectionType: 'USB',
            status: 'ONLINE',
            isDefault: true,
            supportsColor: true,
            supportsDuplex: true,
          },
        });

        // 6. Generate 10-min Pairing Code: ANP-XXXX-XXXX
        const rand1 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const rand2 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const pairingCode = `ANP-${rand1}-${rand2}`;
        const agentToken = `agent_tok_${crypto.randomBytes(16).toString('hex')}`;

        const agent = await tx.printerAgent.create({
          data: {
            shopId: shop.id,
            pairingCode,
            agentToken,
            deviceName: 'Windows Desktop Station',
            status: 'DISCONNECTED',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        });

        // 7. Audit Log
        await tx.auditLog.create({
          data: {
            userId: req.user?.id,
            action: 'ADMIN_CREATE_SHOP',
            entity: 'Shop',
            entityId: shop.id,
            metadata: JSON.stringify({ shopName: name, slug, email }),
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          },
        });

        return { user, shop, qrCodeRecord, agent };
      });

      return res.status(201).json({
        success: true,
        message: 'Shop created successfully by Admin',
        data: {
          shop: result.shop,
          owner: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
          },
          shopUrl: `${getCustomerWebUrl()}/print/${result.shop.slug}`,
          qrDataUrl: result.qrCodeRecord.qrDataUrl,
          pairingCode: result.agent.pairingCode,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin Agent Login Impersonation
   */
  static async impersonateShopLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { shopId } = req.params;
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        include: { owner: true },
      });

      if (!shop || !shop.owner) {
        return res.status(404).json({ success: false, message: 'Shop or owner not found' });
      }

      const accessToken = jwt.sign(
        { id: shop.owner.id, email: shop.owner.email, role: shop.owner.role, sessionVersion: shop.owner.sessionVersion },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: shop.owner.id,
            email: shop.owner.email,
            name: shop.owner.name,
            role: shop.owner.role,
          },
          shop,
          accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List all shops with filter, search, agent status, and pagination
   */
  static async listShops(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search, page = 1, limit = 50 } = req.query;
      const where: any = {};
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { name: { contains: String(search) } },
          { email: { contains: String(search) } },
          { city: { contains: String(search) } },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [shops, total] = await Promise.all([
        prisma.shop.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            owner: { select: { id: true, name: true, email: true, phone: true } },
            agents: { select: { id: true, status: true, deviceName: true, lastHeartbeat: true } },
            printers: { select: { id: true, name: true, status: true } },
            qrCodes: { select: { id: true, code: true, targetUrl: true, qrDataUrl: true, isActive: true } },
            _count: { select: { orders: true, printers: true, agents: true } },
          },
        }),
        prisma.shop.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: shops,
        meta: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update shop status (Approve, Suspend, Activate)
   */
  static async updateShopStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { shopId } = req.params;
      const { status } = req.body;

      const shop = await prisma.shop.update({
        where: { id: shopId },
        data: { status },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action: 'SHOP_STATUS_UPDATE',
          entity: 'Shop',
          entityId: shop.id,
          metadata: JSON.stringify({ newStatus: status }),
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });

      return res.status(200).json({
        success: true,
        message: `Shop status updated to ${status}`,
        data: shop,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Windows Print Agent Version Releases Management
   */
  static async listAgentReleases(req: Request, res: Response, next: NextFunction) {
    try {
      const releases = await prisma.agentVersion.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({ success: true, data: releases });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Download latest agent installer - Returns real stream of .exe binary
   */
  static async downloadLatestAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const latest = (await prisma.agentVersion.findFirst({
        where: { isLatest: true },
      })) || (await prisma.agentVersion.findFirst({ orderBy: { createdAt: 'desc' } }));

      if (latest) {
        await prisma.agentVersion.update({
          where: { id: latest.id },
          data: { downloadCount: latest.downloadCount + 1 },
        });
      }

      // Check for compiled setup installer binary
      const candidates = [
        path.join(__dirname, '../../public/downloads/AnishNovaPrintAgent-Setup.exe'),
        path.join(__dirname, '../../../print-agent/AnishNovaInstaller/bin/Release/net8.0-windows/win-x64/publish/AnishNovaPrintAgent-Setup.exe'),
        path.join(__dirname, '../../../print-agent/AnishNovaInstaller/bin/Release/net8.0-windows/win-x64/AnishNovaPrintAgent-Setup.exe'),
        path.join(__dirname, '../../../print-agent/PrintQRAgent/bin/Release/net8.0-windows/win-x64/publish/PrintQRAgent.exe'),
        path.join(__dirname, '../../../print-agent/AnishNovaInstaller/bin/Debug/net8.0-windows/AnishNovaPrintAgent-Setup.exe'),
        path.join(__dirname, '../../../print-agent/PrintQRAgent/bin/Debug/net8.0-windows/PrintQRAgent.exe'),
      ];

      const targetFile = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).size > 1024);

      if (targetFile) {
        const stat = fs.statSync(targetFile);
        res.setHeader('Content-Disposition', 'attachment; filename="AnishNovaPrintAgent-Setup.exe"');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'no-cache');
        return fs.createReadStream(targetFile).pipe(res);
      }

      return res.status(503).json({
        success: false,
        message: 'Windows Print Agent installer binary is not ready. Run dotnet publish for AnishNovaInstaller.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Download latest direct PrintQRAgent.exe payload for seamless in-app background auto-updates
   */
  static async downloadLatestAgentBinary(req: Request, res: Response, next: NextFunction) {
    try {
      const candidates = [
        path.join(__dirname, '../../public/downloads/PrintQRAgent.exe'),
        path.join(__dirname, '../../../print-agent/PrintQRAgent/bin/Release/net8.0-windows/win-x64/publish/PrintQRAgent.exe'),
        path.join(__dirname, '../../../print-agent/PrintQRAgent/bin/Release/net8.0-windows/win-x64/PrintQRAgent.exe'),
      ];

      const targetFile = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).size > 1024);

      if (targetFile) {
        const stat = fs.statSync(targetFile);
        res.setHeader('Content-Disposition', 'attachment; filename="PrintQRAgent.exe"');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'no-cache');
        return fs.createReadStream(targetFile).pipe(res);
      }

      return res.status(503).json({
        success: false,
        message: 'Windows Print Agent binary is not ready. Run dotnet publish for PrintQRAgent.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Live Agent & Printer Monitoring Telemetry
   */
  static async getAgentMonitoringDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const [agents, onlinePrintersCount, pendingJobs] = await Promise.all([
        prisma.printerAgent.findMany({
          include: {
            shop: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { lastHeartbeat: 'desc' },
        }),
        prisma.printer.count({ where: { status: 'ONLINE' } }),
        prisma.printJob.count({ where: { status: { in: ['QUEUED', 'PROCESSING', 'PRINTING'] } } }),
      ]);

      const connectedCount = agents.filter((a) => a.status === 'CONNECTED').length;
      const offlineCount = agents.length - connectedCount;

      return res.status(200).json({
        success: true,
        data: {
          connectedCount,
          offlineCount,
          onlinePrintersCount,
          pendingJobs,
          agents,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * SaaS Plans CRUD
   */
  static async listPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const plans = await prisma.subscriptionPlan.findMany({
        orderBy: { priceMonthly: 'asc' },
        include: { _count: { select: { shopSubscriptions: true } } },
      });
      return res.status(200).json({ success: true, data: plans });
    } catch (err) {
      next(err);
    }
  }

  static async savePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, name, description, priceMonthly, priceYearly, maxPrinters, maxOrdersPerMonth, features, isPopular } = req.body;

      let plan;
      if (id) {
        plan = await prisma.subscriptionPlan.update({
          where: { id },
          data: {
            name,
            description,
            priceMonthly: Number(priceMonthly),
            priceYearly: Number(priceYearly || priceMonthly * 10),
            maxPrinters: Number(maxPrinters),
            maxOrdersPerMonth: Number(maxOrdersPerMonth),
            features: typeof features === 'string' ? features : JSON.stringify(features),
            isPopular: Boolean(isPopular),
          },
        });
      } else {
        plan = await prisma.subscriptionPlan.create({
          data: {
            name,
            description,
            priceMonthly: Number(priceMonthly),
            priceYearly: Number(priceYearly || priceMonthly * 10),
            maxPrinters: Number(maxPrinters),
            maxOrdersPerMonth: Number(maxOrdersPerMonth),
            features: typeof features === 'string' ? features : JSON.stringify(features),
            isPopular: Boolean(isPopular),
          },
        });
      }

      return res.status(200).json({ success: true, message: 'Plan saved successfully', data: plan });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Testimonials Management
   */
  static async listTestimonials(req: Request, res: Response, next: NextFunction) {
    try {
      const testimonials = await prisma.testimonial.findMany({
        orderBy: { displayOrder: 'asc' },
      });
      return res.status(200).json({ success: true, data: testimonials });
    } catch (err) {
      next(err);
    }
  }

  static async saveTestimonial(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, name, role, shopName, city, review, rating, isApproved, isFeatured, displayOrder } = req.body;

      let testimonial;
      if (id) {
        testimonial = await prisma.testimonial.update({
          where: { id },
          data: {
            name,
            role,
            shopName,
            city,
            review,
            rating: Number(rating),
            isApproved: Boolean(isApproved),
            isFeatured: Boolean(isFeatured),
            displayOrder: Number(displayOrder || 0),
          },
        });
      } else {
        testimonial = await prisma.testimonial.create({
          data: {
            name,
            role,
            shopName,
            city,
            review,
            rating: Number(rating || 5),
            isApproved: true,
            isFeatured: Boolean(isFeatured),
            displayOrder: Number(displayOrder || 0),
          },
        });
      }

      return res.status(200).json({ success: true, message: 'Testimonial saved', data: testimonial });
    } catch (err) {
      next(err);
    }
  }

  static async deleteTestimonial(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await prisma.testimonial.delete({ where: { id } });
      return res.status(200).json({ success: true, message: 'Testimonial deleted' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Demo Video Management
   */
  static async getDemoVideo(req: Request, res: Response, next: NextFunction) {
    try {
      let video = await prisma.demoVideo.findFirst({ where: { isActive: true } });
      if (!video) {
        video = await prisma.demoVideo.create({
          data: {
            title: 'AnishNova Print Demo Walkthrough',
            description: 'Instant mobile document printing directly to Windows printers.',
            videoUrl: 'https://www.youtube-nocookie.com/embed/qOPE-90Um8g',
            provider: 'YOUTUBE',
            isActive: true,
          },
        });
      }
      return res.status(200).json({ success: true, data: video });
    } catch (err) {
      next(err);
    }
  }

  static async saveDemoVideo(req: Request, res: Response, next: NextFunction) {
    try {
      const { title, description, videoUrl, provider, isActive } = req.body;
      const video = await prisma.demoVideo.upsert({
        where: { id: 'demo-video-default' },
        update: {
          title,
          description,
          videoUrl,
          provider: provider || 'YOUTUBE',
          isActive: typeof isActive === 'boolean' ? isActive : true,
        },
        create: {
          id: 'demo-video-default',
          title,
          description,
          videoUrl,
          provider: provider || 'YOUTUBE',
          isActive: true,
        },
      });

      return res.status(200).json({ success: true, message: 'Demo video updated', data: video });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Platform Settings & Statistics
   */
  static async getPlatformSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await prisma.platformSetting.findMany();
      const map: Record<string, string> = {};
      settings.forEach((s) => {
        map[s.key] = s.value;
      });
      return res.status(200).json({ success: true, data: map });
    } catch (err) {
      next(err);
    }
  }

  static async savePlatformSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const { key, value } = req.body;
      const setting = await prisma.platformSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
      return res.status(200).json({ success: true, message: 'Setting saved', data: setting });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Coupon Management
   */
  static async listCoupons(req: Request, res: Response, next: NextFunction) {
    try {
      const coupons = await prisma.coupon.findMany({
        orderBy: { createdAt: 'desc' },
        include: { shop: { select: { name: true } } },
      });
      return res.status(200).json({ success: true, data: coupons });
    } catch (err) {
      next(err);
    }
  }

  static async createCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const data = CouponSchema.parse(req.body);
      const coupon = await prisma.coupon.create({
        data: {
          code: data.code,
          discountType: data.discountType,
          discountValue: data.discountValue,
          minOrderAmount: data.minOrderAmount,
          maxDiscount: data.maxDiscount,
          shopId: data.shopId,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          usageLimit: data.usageLimit,
          isActive: data.isActive,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Coupon created successfully',
        data: coupon,
      });
    } catch (err) {
      next(err);
    }
  }
}

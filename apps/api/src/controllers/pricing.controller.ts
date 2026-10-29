import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { PricingEngineService } from '../services/pricing.service';
import { PricingRuleSchema, PrintSettingsSchema } from '@printqr/validation';
import { PrintSettingsDTO } from '@printqr/types';
import { DEFAULT_PLATFORM_PRICING_RULES } from '@printqr/config';
import { FreePrintEligibilityError, getFreePrintEligibility, getGuestFreePrintEligibility, getVerifiedInstitutionIdForPricing } from '../services/free-print.service';

export class PricingController {
  /**
   * Live Instant Dynamic Price Calculation API for customer configurator
   */
  static async calculatePrice(req: Request, res: Response, next: NextFunction) {
    try {
      const { shopSlug, items, couponCode, freePrintRequested } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one file item is required' });
      }

      const shop = shopSlug ? await prisma.shop.findUnique({
        where: { slug: shopSlug },
        include: { printers: { where: { status: 'ONLINE' }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] } },
      }) : null;
      if (!shop || !shop.isOnline || !shop.printers.length) {
        return res.status(409).json({ success: false, message: 'This shop is not accepting print orders right now' });
      }
      const printer = shop.printers[0];
      const shopId = shop.id;
      const institutionId = await getVerifiedInstitutionIdForPricing(req.user?.id, String(req.get('X-Free-Print-Token') || ''), shopId);

      const itemBreakdowns = [];
      const itemFiles: any[] = [];
      for (const item of items) {
        const file = await prisma.fileRecord.findUnique({
          where: { id: item.fileId },
        });
        if (!file || file.expiresAt <= new Date() || file.shopId !== shop.id) {
          return res.status(400).json({ success: false, message: 'A selected document is missing or has expired' });
        }
        itemFiles.push(file);
        const settings = PrintSettingsSchema.parse(item.settings);
        const pageRange = PricingEngineService.validatePageRange(settings.pageRange, file.pageCount);
        if (!pageRange.valid) return res.status(400).json({ success: false, message: pageRange.message });
        if (settings.colorMode === 'COLOR' && !printer.supportsColor) {
          return res.status(400).json({ success: false, message: 'The selected printer does not support color printing' });
        }
        if (settings.duplexMode !== 'SIMPLEX' && !printer.supportsDuplex) {
          return res.status(400).json({ success: false, message: 'The selected printer does not support duplex printing' });
        }
        const supportedSizes = printer.supportedSizes.split(',').map((size) => size.trim().toUpperCase()).filter(Boolean);
        if (supportedSizes.length && !supportedSizes.includes(settings.paperSize.toUpperCase())) {
          return res.status(400).json({ success: false, message: `The selected printer does not support ${settings.paperSize} paper` });
        }

        const docPages = file.pageCount;
        const fileName = file.originalName;

        const breakdown = await PricingEngineService.calculateItemPrice(
          shopId,
          item.fileId,
          fileName,
          docPages,
          settings as PrintSettingsDTO,
          institutionId
        );
        itemBreakdowns.push({ ...breakdown, colorMode: settings.colorMode });
      }

      const result = await PricingEngineService.calculateOrderTotal(itemBreakdowns, couponCode, shopId);
      if (freePrintRequested === true) {
        const guestToken = String(req.get('X-Free-Print-Token') || '');
        let eligibility: Awaited<ReturnType<typeof getFreePrintEligibility>> | Awaited<ReturnType<typeof getGuestFreePrintEligibility>>;
        try {
          if (req.user && ['STUDENT', 'TEACHER'].includes(req.user.role)) eligibility = await getFreePrintEligibility(req.user.id, shopId, itemBreakdowns.map((item) => item.colorMode));
          else if (guestToken) {
            const guestEligibility = await getGuestFreePrintEligibility(guestToken, shopId, itemBreakdowns.map((item) => item.colorMode));
            eligibility = guestEligibility;
            if (itemFiles.some((file) => file.guestVerificationId !== guestEligibility.verificationId)) return res.status(403).json({ success: false, code: 'FILE_SESSION_MISMATCH', message: 'For free printing, upload your documents using this approved ID session.' });
          } else return res.status(403).json({ success: false, code: 'NOT_VERIFIED', message: 'Upload your college ID and wait for shop approval to request free printing.' });
        }
        catch (error) { if (error instanceof FreePrintEligibilityError) return res.status(403).json({ success: false, code: error.code, message: error.message }); throw error; }
        const requestedPages = itemBreakdowns.reduce((sum, item) => sum + item.selectedPages * item.copies, 0);
        const requestedCopies = itemBreakdowns.reduce((sum, item) => sum + item.copies, 0);
        if (requestedPages > eligibility.remainingDailyPages || requestedPages > eligibility.remainingMonthlyPages || requestedCopies > eligibility.remainingDailyCopies || requestedCopies > eligibility.remainingMonthlyCopies) return res.status(409).json({ success: false, code: 'FREE_LIMIT_EXCEEDED', message: 'This request exceeds your remaining daily or monthly free-print allowance.', data: { remainingDailyPages: eligibility.remainingDailyPages, remainingMonthlyPages: eligibility.remainingMonthlyPages, remainingDailyCopies: eligibility.remainingDailyCopies, remainingMonthlyCopies: eligibility.remainingMonthlyCopies } });
        result.items = result.items.map((item) => ({ ...item, basePrice: 0, duplexDiscount: 0, bulkDiscount: 0, itemTotal: 0 }));
        result.subtotal = 0; result.totalDiscount = 0; result.serviceFee = 0; result.gstAmount = 0; result.finalTotal = 0;
      }

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get pricing rules for shop (guarantees non-empty fallback rules)
   */
  static async getPricingRules(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = req.user?.shopId || req.query.shopId as string;
      let rules = await prisma.pricingRule.findMany({
        where: shopId ? { shopId } : { shopId: null },
      });

      // If empty for this shop, initialize with default platform rules
      if (rules.length === 0 && shopId) {
        for (const r of DEFAULT_PLATFORM_PRICING_RULES) {
          const created = await prisma.pricingRule.create({
            data: {
              shopId,
              paperSize: r.paperSize,
              colorMode: r.colorMode,
              singleSidePrice: r.singleSidePrice,
              duplexPrice: r.duplexPrice,
              duplexDiscountPercent: r.duplexDiscountPercent,
              bulkMinPages: r.bulkMinPages,
              bulkDiscountPercent: r.bulkDiscountPercent,
              isDefault: true,
            },
          });
          rules.push(created);
        }
      }

      if (rules.length === 0) {
        rules = DEFAULT_PLATFORM_PRICING_RULES as any;
      }

      return res.status(200).json({ success: true, data: rules });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update or create a pricing rule
   */
  static async savePricingRule(req: Request, res: Response, next: NextFunction) {
    try {
      const data = PricingRuleSchema.parse(req.body);
      const shopId = req.user?.shopId || data.shopId || null;

      const existing = await prisma.pricingRule.findFirst({
        where: { shopId, paperSize: data.paperSize, colorMode: data.colorMode },
      });

      let savedRule;
      if (existing) {
        savedRule = await prisma.pricingRule.update({
          where: { id: existing.id },
          data: {
            singleSidePrice: Number(data.singleSidePrice),
            duplexPrice: Number(data.duplexPrice),
            duplexDiscountPercent: Number(data.duplexDiscountPercent),
            bulkMinPages: Number(data.bulkMinPages),
            bulkDiscountPercent: Number(data.bulkDiscountPercent),
            isDefault: false,
          },
        });
      } else {
        savedRule = await prisma.pricingRule.create({
          data: {
            shopId,
            paperSize: data.paperSize,
            colorMode: data.colorMode,
            singleSidePrice: Number(data.singleSidePrice),
            duplexPrice: Number(data.duplexPrice),
            duplexDiscountPercent: Number(data.duplexDiscountPercent),
            bulkMinPages: Number(data.bulkMinPages),
            bulkDiscountPercent: Number(data.bulkDiscountPercent),
            isDefault: false,
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Pricing rule saved successfully',
        data: savedRule,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Reset Shop Pricing Rules to Platform Defaults
   */
  static async resetPricingRulesToDefault(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) return res.status(400).json({ success: false, message: 'Shop ID required' });

      await prisma.pricingRule.deleteMany({ where: { shopId } });

      const newRules = [];
      for (const r of DEFAULT_PLATFORM_PRICING_RULES) {
        const created = await prisma.pricingRule.create({
          data: {
            shopId,
            paperSize: r.paperSize,
            colorMode: r.colorMode,
            singleSidePrice: r.singleSidePrice,
            duplexPrice: r.duplexPrice,
            duplexDiscountPercent: r.duplexDiscountPercent,
            bulkMinPages: r.bulkMinPages,
            bulkDiscountPercent: r.bulkDiscountPercent,
            isDefault: true,
          },
        });
        newRules.push(created);
      }

      return res.status(200).json({
        success: true,
        message: 'Shop pricing reset to platform defaults successfully',
        data: newRules,
      });
    } catch (err) {
      next(err);
    }
  }
}

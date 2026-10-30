import { APP_CONFIG, DEFAULT_PLATFORM_PRICING_RULES } from '@printqr/config';
import { PrintSettingsDTO, PricingBreakdown, OrderPriceCalculation } from '@printqr/types';
import { prisma } from '../prisma';

type EffectivePricingRule = {
  id: string;
  paperSize: string;
  colorMode: string;
  singleSidePrice: number;
  duplexPrice: number;
  duplexDiscountPercent: number;
  bulkMinPages: number;
  bulkDiscountPercent: number;
};

export const isInstitutionPricingTableUnavailable = (error: any) => error?.code === 'P2021'
  && String(error?.meta?.table || '').includes('InstitutionPricingRule');

export class PricingEngineService {
  static validatePageRange(pageRange: string, totalPages: number): { valid: boolean; message?: string; count: number } {
    if (!Number.isInteger(totalPages) || totalPages < 1) return { valid: false, message: 'Document page count is invalid', count: 0 };
    if (!pageRange || pageRange.trim().toUpperCase() === 'ALL') return { valid: true, count: totalPages };
    const pages = new Set<number>();
    for (const part of pageRange.split(',')) {
      const token = part.trim();
      if (!/^\d+(?:-\d+)?$/.test(token)) return { valid: false, message: `Invalid page range: ${token}`, count: 0 };
      const [start, end = start] = token.split('-').map(Number);
      if (start < 1 || end < start || end > totalPages) return { valid: false, message: `Page range must be between 1 and ${totalPages}`, count: 0 };
      for (let page = start; page <= end; page += 1) pages.add(page);
    }
    if (!pages.size) return { valid: false, message: 'Choose at least one page to print', count: 0 };
    return { valid: true, count: pages.size };
  }

  /**
   * Parses page range string (e.g. "1-5, 8, 10-12" or "ALL") against total document pages
   */
  static parseSelectedPagesCount(pageRange: string, totalPages: number): number {
    if (!pageRange || pageRange.trim().toUpperCase() === 'ALL') {
      return totalPages;
    }

    const pages = new Set<number>();
    const parts = pageRange.split(',');

    for (const part of parts) {
      const clean = part.trim();
      if (clean.includes('-')) {
        const [startStr, endStr] = clean.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const from = Math.max(1, Math.min(start, end));
          const to = Math.min(totalPages, Math.max(start, end));
          for (let i = from; i <= to; i++) {
            pages.add(i);
          }
        }
      } else {
        const p = parseInt(clean, 10);
        if (!isNaN(p) && p >= 1 && p <= totalPages) {
          pages.add(p);
        }
      }
    }

    return pages.size > 0 ? pages.size : totalPages;
  }

  /**
   * Calculates pricing for an order item against shop or global pricing rules
   */
  static async calculateItemPrice(
    shopId: string,
    fileId: string,
    fileName: string,
    documentTotalPages: number,
    settings: PrintSettingsDTO,
    institutionId?: string,
  ): Promise<PricingBreakdown> {
    const selectedPages = this.parseSelectedPagesCount(settings.pageRange, documentTotalPages);
    const copies = Math.max(1, settings.copies || 1);
    const pagesPerSheet = settings.pagesPerSheet || 1;

    // Calculate effective sheets of paper needed
    const sheetsPerCopy = Math.ceil(selectedPages / pagesPerSheet);
    const isDuplex = settings.duplexMode !== 'SIMPLEX';
    const totalPhysicalSheets = isDuplex
      ? Math.ceil(sheetsPerCopy / 2) * copies
      : sheetsPerCopy * copies;

    // Institution overrides take precedence, then the shop rule, then platform defaults.
    let rule: EffectivePricingRule | null = null;
    if (institutionId) {
      try {
        rule = await prisma.institutionPricingRule.findUnique({
          where: { institutionId_paperSize_colorMode: { institutionId, paperSize: settings.paperSize, colorMode: settings.colorMode } },
        });
      } catch (error) {
        // Keep legacy pricing available while a release's additive migration is pending.
        if (!isInstitutionPricingTableUnavailable(error)) throw error;
      }
    }

    if (!rule) rule = await prisma.pricingRule.findFirst({
      where: {
        shopId,
        paperSize: settings.paperSize,
        colorMode: settings.colorMode,
      },
    });

    if (!rule) {
      // Find fallback default
      const defaultRule = DEFAULT_PLATFORM_PRICING_RULES.find(
        (r) => r.paperSize === settings.paperSize && r.colorMode === settings.colorMode
      ) || DEFAULT_PLATFORM_PRICING_RULES[0];

      rule = {
        id: defaultRule.id,
        paperSize: defaultRule.paperSize,
        colorMode: defaultRule.colorMode,
        singleSidePrice: defaultRule.singleSidePrice,
        duplexPrice: defaultRule.duplexPrice,
        duplexDiscountPercent: defaultRule.duplexDiscountPercent,
        bulkMinPages: defaultRule.bulkMinPages,
        bulkDiscountPercent: defaultRule.bulkDiscountPercent,
      };
    }

    // Base price calculation
    let basePrice = 0;
    let duplexDiscount = 0;
    const totalImpressions = selectedPages * copies;

    if (isDuplex) {
      // Double side price per physical sheet
      const duplexSheetPrice = rule.duplexPrice;
      basePrice = totalPhysicalSheets * duplexSheetPrice;
      const singleEquivalent = totalImpressions * rule.singleSidePrice;
      duplexDiscount = Math.max(0, singleEquivalent - basePrice);
    } else {
      basePrice = totalImpressions * rule.singleSidePrice;
    }

    // Bulk discount calculation
    let bulkDiscount = 0;
    if (totalImpressions >= rule.bulkMinPages && rule.bulkDiscountPercent > 0) {
      bulkDiscount = (basePrice * rule.bulkDiscountPercent) / 100;
    }

    const itemTotal = Math.max(0, basePrice - bulkDiscount);

    return {
      fileId,
      fileName,
      pageCount: documentTotalPages,
      selectedPages,
      copies,
      effectiveSheets: totalPhysicalSheets,
      unitPricePerPage: rule.singleSidePrice,
      basePrice: Number(basePrice.toFixed(2)),
      duplexDiscount: Number(duplexDiscount.toFixed(2)),
      bulkDiscount: Number(bulkDiscount.toFixed(2)),
      itemTotal: Number(itemTotal.toFixed(2)),
    };
  }

  /**
   * Calculates grand total with taxes, coupons, and fees
   */
  static async calculateOrderTotal(
    items: PricingBreakdown[],
    couponCode?: string,
    shopId?: string
  ): Promise<OrderPriceCalculation> {
    const subtotal = items.reduce((sum, item) => sum + item.itemTotal, 0);

    let couponDiscount = 0;
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode.trim().toUpperCase() },
      });

      if (coupon && coupon.isActive) {
        const isNotExpired = !coupon.expiresAt || new Date(coupon.expiresAt) > new Date();
        const meetsMinAmount = subtotal >= coupon.minOrderAmount;
        const withinShop = !coupon.shopId || coupon.shopId === shopId;

        if (isNotExpired && meetsMinAmount && withinShop) {
          if (coupon.discountType === 'PERCENTAGE') {
            couponDiscount = (subtotal * coupon.discountValue) / 100;
            if (coupon.maxDiscount) {
              couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
            }
          } else {
            couponDiscount = coupon.discountValue;
          }
        }
      }
    }

    const discountedSubtotal = Math.max(0, subtotal - couponDiscount);
    // Admin-managed platform settings are authoritative when present. The environment
    // values remain a compatibility default for installations not yet seeded.
    const platformSettings = await prisma.platformSetting.findMany({
      where: { key: { in: ['PLATFORM_SERVICE_FEE', 'GST_RATE'] } },
    });
    const settingValues = new Map(platformSettings.map((setting) => [setting.key, Number(setting.value)]));
    const configuredFee = settingValues.get('PLATFORM_SERVICE_FEE');
    const configuredGst = settingValues.get('GST_RATE');
    const serviceFee = Number.isFinite(configuredFee) && configuredFee! >= 0
      ? configuredFee!
      : APP_CONFIG.PLATFORM_SERVICE_FEE;
    const gstRatePercent = Number.isFinite(configuredGst) && configuredGst! >= 0
      ? configuredGst!
      : APP_CONFIG.GST_RATE_PERCENT;
    const gstAmount = (discountedSubtotal * gstRatePercent) / 100;
    const finalTotal = discountedSubtotal + gstAmount + serviceFee;

    return {
      items,
      subtotal: Number(subtotal.toFixed(2)),
      totalDiscount: Number(couponDiscount.toFixed(2)),
      serviceFee: Number(serviceFee.toFixed(2)),
      gstRatePercent,
      gstAmount: Number(gstAmount.toFixed(2)),
      finalTotal: Number(finalTotal.toFixed(2)),
    };
  }
}

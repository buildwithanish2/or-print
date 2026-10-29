import { PaperSize, ColorMode, PricingRuleDTO } from '@printqr/types';

export const APP_CONFIG = {
  BRAND_NAME: 'AnishNova Print',
  COMPANY_NAME: 'AnishNova Technologies',
  DEVELOPED_BY: 'Developed by AnishNova Technologies',
  BRAND_TAGLINE: 'Print Documents From Your Phone. Instantly.',
  SUB_TAGLINE: 'Scan. Upload. Pay. Print.',
  GST_RATE_PERCENT: 18,
  PLATFORM_SERVICE_FEE: 2.0, // Fixed convenience fee per order in INR
  DEFAULT_CURRENCY: 'INR',
  CURRENCY_SYMBOL: '₹',
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50 MB
  FILE_RETENTION_HOURS: 24,
  ORDER_RETENTION_DAYS: 90,
  AGENT_HEARTBEAT_INTERVAL_SEC: 15,
  AGENT_DISCONNECT_TIMEOUT_SEC: 45,
  MAX_PRINT_RETRY_ATTEMPTS: 3,
  PAIRING_CODE_VALIDITY_MINUTES: 10,
};

export const SUPPORTED_MIME_TYPES = {
  // Documents
  'application/pdf': { ext: 'pdf', category: 'PDF' as const, label: 'PDF Document' },
  'application/msword': { ext: 'doc', category: 'DOCUMENT' as const, label: 'Word Document (Legacy)' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', category: 'DOCUMENT' as const, label: 'Word Document' },
  
  // Spreadsheets
  'application/vnd.ms-excel': { ext: 'xls', category: 'SPREADSHEET' as const, label: 'Excel Spreadsheet (Legacy)' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', category: 'SPREADSHEET' as const, label: 'Excel Spreadsheet' },
  
  // Presentations
  'application/vnd.ms-powerpoint': { ext: 'ppt', category: 'PRESENTATION' as const, label: 'PowerPoint Presentation (Legacy)' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: 'pptx', category: 'PRESENTATION' as const, label: 'PowerPoint Presentation' },
  
  // Images
  'image/jpeg': { ext: 'jpg', category: 'IMAGE' as const, label: 'JPEG Image' },
  'image/jpg': { ext: 'jpg', category: 'IMAGE' as const, label: 'JPEG Image' },
  'image/png': { ext: 'png', category: 'IMAGE' as const, label: 'PNG Image' },
  'image/webp': { ext: 'webp', category: 'IMAGE' as const, label: 'WebP Image' },
};

export const PAPER_SIZE_SPECS: Record<PaperSize, { name: string; widthMm: number; heightMm: number; ratio: number }> = {
  A4: { name: 'A4 Standard', widthMm: 210, heightMm: 297, ratio: 297 / 210 },
  A3: { name: 'A3 Poster/Drawing', widthMm: 297, heightMm: 420, ratio: 420 / 297 },
  A5: { name: 'A5 Booklet', widthMm: 148, heightMm: 210, ratio: 210 / 148 },
  LETTER: { name: 'US Letter', widthMm: 215.9, heightMm: 279.4, ratio: 279.4 / 215.9 },
  LEGAL: { name: 'US Legal (Stamp Paper)', widthMm: 215.9, heightMm: 355.6, ratio: 355.6 / 215.9 },
  CUSTOM: { name: 'Custom Size', widthMm: 210, heightMm: 297, ratio: 1.414 },
};

export const DEFAULT_PLATFORM_PRICING_RULES: PricingRuleDTO[] = [
  {
    id: 'default-a4-bw',
    shopId: null,
    paperSize: 'A4',
    colorMode: 'BW',
    singleSidePrice: 2.0,
    duplexPrice: 3.5,
    duplexDiscountPercent: 12.5,
    bulkMinPages: 50,
    bulkDiscountPercent: 10,
    isDefault: true,
  },
  {
    id: 'default-a4-color',
    shopId: null,
    paperSize: 'A4',
    colorMode: 'COLOR',
    singleSidePrice: 10.0,
    duplexPrice: 18.0,
    duplexDiscountPercent: 10.0,
    bulkMinPages: 25,
    bulkDiscountPercent: 15,
    isDefault: true,
  },
  {
    id: 'default-a3-bw',
    shopId: null,
    paperSize: 'A3',
    colorMode: 'BW',
    singleSidePrice: 5.0,
    duplexPrice: 9.0,
    duplexDiscountPercent: 10.0,
    bulkMinPages: 20,
    bulkDiscountPercent: 10,
    isDefault: true,
  },
  {
    id: 'default-a3-color',
    shopId: null,
    paperSize: 'A3',
    colorMode: 'COLOR',
    singleSidePrice: 20.0,
    duplexPrice: 36.0,
    duplexDiscountPercent: 10.0,
    bulkMinPages: 20,
    bulkDiscountPercent: 15,
    isDefault: true,
  },
  {
    id: 'default-a5-bw',
    shopId: null,
    paperSize: 'A5',
    colorMode: 'BW',
    singleSidePrice: 1.5,
    duplexPrice: 2.8,
    duplexDiscountPercent: 7.0,
    bulkMinPages: 50,
    bulkDiscountPercent: 10,
    isDefault: true,
  },
  {
    id: 'default-a5-color',
    shopId: null,
    paperSize: 'A5',
    colorMode: 'COLOR',
    singleSidePrice: 7.0,
    duplexPrice: 13.0,
    duplexDiscountPercent: 7.0,
    bulkMinPages: 25,
    bulkDiscountPercent: 10,
    isDefault: true,
  },
  {
    id: 'default-legal-bw',
    shopId: null,
    paperSize: 'LEGAL',
    colorMode: 'BW',
    singleSidePrice: 3.0,
    duplexPrice: 5.5,
    duplexDiscountPercent: 8.0,
    bulkMinPages: 30,
    bulkDiscountPercent: 10,
    isDefault: true,
  },
];

export const AVAILABLE_SERVICES_CATALOG = [
  { code: 'DOC_PRINT', name: 'Document Printing', description: 'Fast black & white and color laser printouts', icon: 'FileText' },
  { code: 'PHOTO_PRINT', name: 'Photo Printing', description: 'High-gloss photo paper prints (4x6, 5x7, A4)', icon: 'Image' },
  { code: 'PASSPORT_PHOTO', name: 'Passport Photos', description: 'Instant 8-in-1 standard biometric passport photos', icon: 'UserSquare' },
  { code: 'RESUME_PRINT', name: 'Resume & CV Printing', description: 'Premium 100gsm bond paper printouts', icon: 'Briefcase' },
  { code: 'LAMINATION', name: 'Hot Lamination', description: 'Durable waterproof pouch lamination for ID & documents', icon: 'Shield' },
  { code: 'BINDING', name: 'Spiral & Hard Binding', description: 'Professional book and project binding with transparent cover', icon: 'BookOpen' },
  { code: 'SCANNING', name: 'High-Res Document Scanning', description: '600 DPI PDF/Image document digitization', icon: 'Scan' },
];

export const SAAS_PLANS_DATA = [
  {
    id: 'plan-demo',
    name: 'Demo',
    description: 'Perfect for trying AnishNova Print at single counter shops',
    priceMonthly: 0,
    maxPrinters: 1,
    maxOrdersPerMonth: 50,
    features: ['1 Windows Printer Connection', 'Up to 50 monthly customer orders', 'Standard Counter QR stand flyer', 'Direct UPI QR Payments', 'Community Support'],
    isPopular: false,
    ctaText: 'Start Free Trial',
  },
  {
    id: 'plan-starter',
    name: 'Starter',
    description: 'Designed for college campus stationery and photocopy centers',
    priceMonthly: 649,
    maxPrinters: 2,
    maxOrdersPerMonth: 500,
    features: ['2 Printer Connections', 'Up to 500 monthly orders', 'Custom Standee Flyer Designer', 'Instant Windows Spooler Dispatch', 'SMS & WhatsApp order notifications', 'Standard Email Support'],
    isPopular: false,
    ctaText: 'Choose Starter',
  },
  {
    id: 'plan-pro',
    name: 'Pro',
    description: 'Most popular for high-volume commercial digital print centers',
    priceMonthly: 799,
    maxPrinters: 5,
    maxOrdersPerMonth: 2500,
    features: ['5 Printer Connections', 'Up to 2,500 monthly orders', 'Offline Queue Buffer', 'Duplex & Color Multi-Machine Routing', 'Staff Operator Accounts', 'Priority Support'],
    isPopular: true,
    ctaText: 'Get Pro Access',
  },
  {
    id: 'plan-premium',
    name: 'Premium',
    description: 'Enterprise grade for multi-branch printing hubs and mega xerox',
    priceMonthly: 999,
    maxPrinters: 15,
    maxOrdersPerMonth: 10000,
    features: ['Unlimited Printer Connections', 'Unlimited monthly orders', 'Custom Store Domain Support', 'Dedicated Windows Background Daemon', 'Full Revenue Analytics & Exports', '24/7 Dedicated Support Hotline'],
    isPopular: false,
    ctaText: 'Get Premium',
  },
];

export const getApiBaseUrl = (): string => {
  return resolveServerPortalUrl(
    typeof process !== 'undefined' ? process.env?.API_PUBLIC_URL || process.env?.PUBLIC_API_URL : undefined,
    'https://api.anishnova.com',
    'http://localhost:5000',
  );
};

const resolveServerPortalUrl = (configured: string | undefined, productionFallback: string, developmentFallback: string): string => {
  const isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  if (!isProduction) return (configured || developmentFallback).replace(/\/+$/, '');
  if (configured) {
    try {
      const parsed = new URL(configured);
      const localHost = parsed.hostname === 'localhost' || parsed.hostname.endsWith('.localhost')
        || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
      if (parsed.protocol === 'https:' && !localHost && !parsed.username && !parsed.password) {
        return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
      }
    } catch {
      // Use the known production portal if the configured URL is invalid.
    }
  }
  return productionFallback;
};

export const getCustomerWebUrl = (): string => {
  const isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  const configuredUrl = typeof process !== 'undefined' ? process.env?.CUSTOMER_PORTAL_URL : undefined;
  if (configuredUrl) {
    if (!isProduction) return configuredUrl.replace(/\/$/, '');
    try {
      const parsed = new URL(configuredUrl);
      const isLocalHost = parsed.hostname === 'localhost'
        || parsed.hostname.endsWith('.localhost')
        || parsed.hostname === '127.0.0.1'
        || parsed.hostname === '[::1]';
      if (parsed.protocol === 'https:' && !isLocalHost && !parsed.username && !parsed.password) {
        return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
      }
    } catch {
      // Invalid production portal configuration uses the known deployed portal.
    }
  }
  return isProduction ? 'https://customer-web-six-livid.vercel.app' : 'http://localhost:5173';
};

export const getShopWebUrl = (): string => {
  return resolveServerPortalUrl(
    typeof process !== 'undefined' ? process.env?.SHOP_PORTAL_URL || process.env?.APP_PUBLIC_URL : undefined,
    'https://shop-dashboard-one-eosin.vercel.app',
    'http://localhost:5174',
  );
};

export const getAdminWebUrl = (): string => {
  return resolveServerPortalUrl(
    typeof process !== 'undefined' ? process.env?.ADMIN_PORTAL_URL : undefined,
    'https://or-print.vercel.app',
    'http://localhost:5175',
  );
};

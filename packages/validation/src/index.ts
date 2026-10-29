import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const ShopRegistrationSchema = z.object({
  shopName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(12, 'Use at least 12 characters for your password').max(128),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
  address: z.string().trim().max(240).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  state: z.string().trim().max(100).optional().or(z.literal('')),
  pin: z.string().regex(/^\d{6}$/).optional().or(z.literal('')),
  country: z.string().trim().max(80).optional(),
  gst: z.string().trim().max(32).optional().or(z.literal('')),
  planId: z.string().optional(),
  planSlug: z.string().optional(),
  subscriptionPaymentAttemptId: z.string().optional(),
  razorpayOrderId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  razorpaySignature: z.string().optional(),
  printerModel: z.string().trim().max(120).optional(),
  printerConnectionType: z.enum(['USB', 'NETWORK', 'BLUETOOTH']).optional(),
}).strict().refine((value) => Boolean(value.planId || value.planSlug), {
  message: 'Choose a subscription plan', path: ['planId'],
});

export const ShopCreateSchema = z.object({
  name: z.string().min(3, 'Shop name must be at least 3 characters'),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  email: z.string().email('Valid shop email is required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, '10-digit mobile number required'),
  address: z.string().min(5, 'Full street address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pin: z.string().regex(/^\d{6}$/, '6-digit PIN code required'),
  gst: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional().or(z.literal('')),
  startingPrice: z.number().min(0.5).default(2.0),
  activePlanId: z.string().optional(),
});

export const ShopUpdateSchema = ShopCreateSchema.partial();

export const PrintSettingsSchema = z.object({
  colorMode: z.enum(['BW', 'COLOR']).default('BW'),
  paperSize: z.enum(['A4', 'A3', 'A5', 'LETTER', 'LEGAL', 'CUSTOM']).default('A4'),
  orientation: z.enum(['PORTRAIT', 'LANDSCAPE', 'AUTO']).default('PORTRAIT'),
  duplexMode: z.enum(['SIMPLEX', 'DUPLEX_LONG_EDGE', 'DUPLEX_SHORT_EDGE']).default('SIMPLEX'),
  copies: z.number().int().min(1, 'At least 1 copy required').max(1000).default(1),
  pageRange: z.string().default('ALL'),
  pagesPerSheet: z.literal(1).default(1),
  quality: z.enum(['DRAFT', 'NORMAL', 'HIGH']).default('NORMAL'),
});

export const OrderItemInputSchema = z.object({
  fileId: z.string().uuid('Valid file ID is required'),
  settings: PrintSettingsSchema,
});

export const CreateOrderSchema = z.object({
  shopSlug: z.string().min(1, 'Shop slug is required'),
  idempotencyKey: z.string().min(16).max(128).optional(),
  freePrintRequested: z.boolean().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().regex(/^[6-9]\d{9}$/, '10-digit mobile number required').optional().or(z.literal('')),
  customerEmail: z.string().email().optional().or(z.literal('')),
  items: z.array(OrderItemInputSchema).min(1, 'At least one file must be configured for printing'),
  paymentMethod: z.enum(['UPI', 'RAZORPAY_CARD', 'RAZORPAY_NETBANKING', 'PAY_AT_COUNTER']),
  couponCode: z.string().optional(),
  notes: z.string().max(250).optional(),
});

export const PricingRuleSchema = z.object({
  shopId: z.string().uuid().optional().nullable(),
  paperSize: z.enum(['A4', 'A3', 'A5', 'LETTER', 'LEGAL', 'CUSTOM']),
  colorMode: z.enum(['BW', 'COLOR']),
  singleSidePrice: z.number().min(0.1, 'Price per page must be greater than zero'),
  duplexPrice: z.number().min(0.1, 'Duplex price must be greater than zero'),
  duplexDiscountPercent: z.number().min(0).max(100).default(0),
  bulkMinPages: z.number().int().min(1).default(50),
  bulkDiscountPercent: z.number().min(0).max(100).default(0),
});

export const InstitutionPricingRuleSchema = z.object({
  paperSize: z.enum(['A4', 'A3', 'A5', 'LETTER', 'LEGAL', 'CUSTOM']),
  colorMode: z.enum(['BW', 'COLOR']),
  singleSidePrice: z.number().finite().min(0.1).max(100000),
  duplexPrice: z.number().finite().min(0.1).max(100000),
  duplexDiscountPercent: z.number().finite().min(0).max(100).default(0),
  bulkMinPages: z.number().int().min(1).max(100000).default(50),
  bulkDiscountPercent: z.number().finite().min(0).max(100).default(0),
});

export const CouponSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.number().min(1, 'Discount value must be at least 1'),
  minOrderAmount: z.number().min(0).default(0),
  maxDiscount: z.number().min(0).optional().nullable(),
  shopId: z.string().uuid().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const AgentPairingSchema = z.object({
  pairingCode: z.string().length(6, 'Pairing code must be 6 digits'),
  deviceName: z.string().min(1),
  osVersion: z.string().optional(),
  agentVersion: z.string().optional(),
});

export const AgentJobUpdateSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['QUEUED', 'DOWNLOADING', 'SENT_TO_SPOOLER', 'PRINTING', 'COMPLETED', 'FAILED', 'RETRYING']),
  progress: z.number().min(0).max(100).default(0),
  errorMessage: z.string().optional().nullable(),
  spoolerJobId: z.number().int().optional().nullable(),
});

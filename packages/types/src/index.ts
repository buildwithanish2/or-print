// User & Authentication Roles
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'FINANCE' | 'SHOP_OWNER' | 'SHOP_STAFF' | 'CUSTOMER';

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: UserRole;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: UserDTO;
  accessToken: string;
  refreshToken?: string;
  shop?: ShopDTO | null;
}

// Shop Definitions
export type ShopStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export interface ShopDTO {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pin: string;
  gst?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  status: ShopStatus;
  isOnline: boolean;
  activePlanId?: string | null;
  businessHours?: {
    open: string;
    close: string;
    days: string[];
    is24Hours?: boolean;
  } | null;
  startingPrice?: number;
  qrCodeUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Printer & Agent Definitions
export type PrinterStatus = 'ONLINE' | 'OFFLINE' | 'PRINTING' | 'ERROR' | 'PAUSED';
export type PrinterConnectionType = 'USB' | 'NETWORK_IP' | 'BLUETOOTH' | 'SHARED_SPOOLER';

export interface PrinterDTO {
  id: string;
  shopId: string;
  name: string;
  model: string;
  connectionType: PrinterConnectionType;
  status: PrinterStatus;
  isDefault: boolean;
  supportsColor: boolean;
  supportsDuplex: boolean;
  supportedSizes: string | string[];
  inkLevel?: number | null;
  paperLevel?: number | null;
  lastSeenAt?: string | null;
  totalJobsPrinted?: number;
  createdAt: string;
}

export interface PrinterAgentDTO {
  id: string;
  shopId: string;
  pairingCode: string;
  agentToken?: string;
  deviceName: string;
  ipAddress?: string | null;
  osVersion?: string | null;
  agentVersion?: string | null;
  status: 'CONNECTED' | 'DISCONNECTED';
  lastHeartbeat?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

export interface AgentVersionDTO {
  id: string;
  version: string;
  platform: string;
  filePath: string;
  fileSize: number;
  releaseNotes?: string | null;
  downloadCount: number;
  isLatest: boolean;
  createdAt: string;
}

// File Record & Processing
export type FileCategory = 'PDF' | 'IMAGE' | 'DOCUMENT' | 'SPREADSHEET' | 'PRESENTATION';

export interface FileRecordDTO {
  id: string;
  shopId?: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  category: FileCategory;
  url: string;
  previewUrl?: string | null;
  thumbnailUrls?: string[];
  expiresAt: string;
  createdAt: string;
}

// Print Settings & Item Configuration
export type ColorMode = 'BW' | 'COLOR';
export type PaperSize = 'A4' | 'A3' | 'A5' | 'LETTER' | 'LEGAL' | 'CUSTOM';
export type PageOrientation = 'PORTRAIT' | 'LANDSCAPE' | 'AUTO';
export type DuplexMode = 'SIMPLEX' | 'DUPLEX_LONG_EDGE' | 'DUPLEX_SHORT_EDGE';
export type PrintQuality = 'DRAFT' | 'NORMAL' | 'HIGH';
export type PagesPerSheet = 1 | 2 | 4 | 6 | 9;

export interface PrintSettingsDTO {
  colorMode: ColorMode;
  paperSize: PaperSize;
  orientation: PageOrientation;
  duplexMode: DuplexMode;
  copies: number;
  pageRange: string;
  pagesPerSheet: PagesPerSheet;
  quality: PrintQuality;
  selectedPagesCount: number;
}

export interface OrderItemDTO {
  id: string;
  orderId: string;
  fileId: string;
  file?: FileRecordDTO;
  settings?: PrintSettingsDTO;
  colorMode?: ColorMode | string;
  paperSize?: PaperSize | string;
  orientation?: PageOrientation | string;
  duplexMode?: DuplexMode | string;
  copies?: number;
  pageRange?: string;
  pagesPerSheet?: PagesPerSheet | number;
  quality?: PrintQuality | string;
  selectedPagesCount?: number;
  calculatedPrice: number;
  createdAt: string;
}

// Order & Payment Definitions
export type OrderPaymentStatus = 'PENDING' | 'PAYMENT_PENDING' | 'PAYMENT_SUBMITTED' | 'PAYMENT_DETECTED' | 'PAYMENT_VERIFIED' | 'PAID' | 'FAILED' | 'PAYMENT_FAILED' | 'REFUNDED' | 'CASH_ON_COUNTER' | 'NOT_REQUIRED';
export type OrderPrintStatus = 'RECEIVED' | 'PAYMENT_CONFIRMED' | 'QUEUED' | 'PROCESSING' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type PaymentMethod = 'UPI' | 'RAZORPAY_CARD' | 'RAZORPAY_NETBANKING' | 'PAY_AT_COUNTER' | 'CASHFREE' | 'STRIPE' | 'COLLEGE_FREE';

export interface OrderDTO {
  id: string;
  orderNumber: string; // ANP-XXXXXX
  shopId: string;
  shop?: ShopDTO;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  guestSessionId?: string | null;
  items: OrderItemDTO[];
  printJobs?: PrintJobDTO[];
  totalPages: number;
  totalCopies: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  serviceFee: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: OrderPaymentStatus;
  printStatus: OrderPrintStatus;
  trackingToken: string;
  couponCode?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

// Print Jobs dispatched to Windows Agent
export type PrintJobStatus = 'QUEUED' | 'DOWNLOADING' | 'SENT_TO_SPOOLER' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'RETRYING';

export interface PrintJobDTO {
  id: string;
  orderId: string;
  orderNumber: string;
  orderItemId: string;
  shopId: string;
  printerId: string;
  printer?: PrinterDTO;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  settings: PrintSettingsDTO;
  idempotencyKey: string;
  status: PrintJobStatus;
  progressPercent: number;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string | null;
  spoolerJobId?: number | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

// Pricing Rules & Engine
export interface PricingRuleDTO {
  id: string;
  shopId?: string | null;
  paperSize: PaperSize | string;
  colorMode: ColorMode | string;
  singleSidePrice: number;
  duplexPrice: number;
  duplexDiscountPercent: number;
  bulkMinPages: number;
  bulkDiscountPercent: number;
  isDefault: boolean;
}

export interface PricingBreakdown {
  fileId: string;
  fileName: string;
  pageCount: number;
  selectedPages: number;
  copies: number;
  effectiveSheets: number;
  unitPricePerPage: number;
  basePrice: number;
  duplexDiscount: number;
  bulkDiscount: number;
  itemTotal: number;
}

export interface OrderPriceCalculation {
  items: PricingBreakdown[];
  subtotal: number;
  totalDiscount: number;
  serviceFee: number;
  gstRatePercent: number;
  gstAmount: number;
  finalTotal: number;
}

// SaaS Plans & Subscriptions
export interface SubscriptionPlanDTO {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  maxPrinters: number;
  maxOrdersPerMonth: number;
  features: string | string[];
  isPopular?: boolean;
}

// Coupon Definitions
export interface CouponDTO {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED' | string;
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number | null;
  shopId?: string | null;
  expiresAt?: string | null;
  usageLimit?: number | null;
  usedCount?: number;
  isActive: boolean;
}

// Real-Time WebSocket Events
export interface SocketEventMap {
  'order:updated': (order: OrderDTO) => void;
  'job:status': (job: PrintJobDTO) => void;
  'printer:status': (printer: PrinterDTO) => void;
  'printer:discovered': (printers: PrinterDTO[]) => void;
  'queue:updated': (jobs: PrintJobDTO[]) => void;
  
  'agent:register': (payload: { pairingCode?: string; agentToken?: string; deviceName: string; osVersion?: string }) => void;
  'agent:heartbeat': (payload: { timestamp: number; activeJobsCount: number; printers: Partial<PrinterDTO>[] }) => void;
  'agent:job_update': (payload: { jobId: string; status: PrintJobStatus; progress: number; errorMessage?: string }) => void;
  
  'agent:print_job': (job: PrintJobDTO) => void;
  'agent:test_print': (payload: { printerName: string; testId: string }) => void;
  'agent:cancel_job': (payload: { jobId: string }) => void;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

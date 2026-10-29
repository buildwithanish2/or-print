import { PricingRuleDTO } from '@printqr/types';

export interface PrinterCapabilities {
  printerName: string;
  supportsColor: boolean;
  supportsDuplex: boolean;
  supportedSizes: string[];
}

export interface CustomerShop {
  id: string;
  name: string;
  slug: string;
  phone?: string;
  address?: string;
  city?: string;
  isOnline: boolean;
  startingPrice: number;
  printersCount: number;
  printerCapabilities: PrinterCapabilities | null;
  pricingRules?: PricingRuleDTO[];
  logoUrl?: string | null;
}

export interface CustomerPaymentMethod {
  id: 'UPI' | 'PAY_AT_COUNTER' | 'RAZORPAY_CARD';
  label: string;
  enabled: boolean;
  icon?: string;
}

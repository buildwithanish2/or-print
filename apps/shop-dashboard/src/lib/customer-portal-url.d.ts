export const PRODUCTION_CUSTOMER_PORTAL_URL: string;
export function resolveCustomerPortalBaseUrl(configuredUrl: string | undefined, isProduction: boolean): string;
export function buildCustomerPrintUrl(baseUrl: string, shopSlug: unknown, isProduction: boolean): string | null;

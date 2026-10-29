/**
 * Build a shop-specific customer URL. Production links must never point to a local host.
 * Returns null for a missing slug or an invalid/unsafe base URL.
 */
export const PRODUCTION_CUSTOMER_PORTAL_URL = 'https://customer-web-six-livid.vercel.app';

function isLocalHost(hostname) {
  return hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === '127.0.0.1'
    || hostname === '[::1]';
}

export function resolveCustomerPortalBaseUrl(configuredUrl, isProduction) {
  if (isProduction) {
    try {
      const configured = new URL(configuredUrl);
      if (configured.protocol === 'https:' && !isLocalHost(configured.hostname) && !configured.username && !configured.password) {
        return configured.origin;
      }
    } catch {
      // Use the known production customer portal if Vercel has a missing or invalid value.
    }
    return PRODUCTION_CUSTOMER_PORTAL_URL;
  }

  return configuredUrl || 'http://localhost:5173';
}

export function buildCustomerPrintUrl(baseUrl, shopSlug, isProduction) {
  if (typeof shopSlug !== 'string' || !shopSlug.trim()) return null;

  try {
    const base = new URL(baseUrl);
    if (!['http:', 'https:'].includes(base.protocol)
      || base.username
      || base.password
      || (isProduction && (base.protocol !== 'https:' || isLocalHost(base.hostname)))) return null;

    return `${base.origin}/print/${encodeURIComponent(shopSlug.trim())}`;
  } catch {
    return null;
  }
}

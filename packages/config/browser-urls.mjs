export const PRODUCTION_API_BASE_URL = 'https://api.anishnova.com/api';
export const PRODUCTION_CUSTOMER_WEB_URL = 'https://customer-web-six-livid.vercel.app';
export const PRODUCTION_SHOP_WEB_URL = 'https://shop-dashboard-one-eosin.vercel.app';
export const PRODUCTION_ADMIN_WEB_URL = 'https://or-print.vercel.app';

const isLoopbackHost = (hostname) => hostname === 'localhost'
  || hostname.endsWith('.localhost')
  || hostname === '127.0.0.1'
  || hostname === '[::1]';

const parsePublicHttpsUrl = (value) => {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || isLoopbackHost(parsed.hostname)
      || parsed.username || parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
};

export function resolvePublicApiBaseUrl(configuredUrl, isProduction) {
  if (!isProduction) return configuredUrl || 'http://localhost:5000/api';
  const parsed = parsePublicHttpsUrl(configuredUrl);
  return parsed ? `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}` : PRODUCTION_API_BASE_URL;
}

export function resolvePublicSocketUrl(configuredSocketUrl, configuredApiUrl, isProduction) {
  if (!isProduction) return configuredSocketUrl || 'http://localhost:5000';
  return parsePublicHttpsUrl(configuredSocketUrl)?.origin
    || parsePublicHttpsUrl(configuredApiUrl)?.origin
    || new URL(PRODUCTION_API_BASE_URL).origin;
}

export function resolvePublicPortalUrl(configuredUrl, isProduction, productionFallback, developmentFallback) {
  if (!isProduction) return configuredUrl || developmentFallback;
  const parsed = parsePublicHttpsUrl(configuredUrl);
  return parsed ? `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}` : productionFallback;
}

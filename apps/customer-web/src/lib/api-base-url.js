export const PRODUCTION_API_BASE_URL = 'https://api.anishnova.com/api';

function isLocalHost(hostname) {
  return hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === '127.0.0.1'
    || hostname === '[::1]';
}

export function resolveApiBaseUrl(configuredUrl, isProduction) {
  if (isProduction) {
    try {
      const configured = new URL(configuredUrl);
      if (configured.protocol === 'https:' && !isLocalHost(configured.hostname) && !configured.username && !configured.password) {
        return `${configured.origin}${configured.pathname.replace(/\/+$/, '')}`;
      }
    } catch {
      // Use the known production API when Vercel has a missing or invalid value.
    }
    return PRODUCTION_API_BASE_URL;
  }

  return configuredUrl || 'http://localhost:5000/api';
}

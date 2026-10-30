export const SHOP_TAB_PATHS = Object.freeze({
  overview: '/',
  queue: '/queue',
  orders: '/orders',
  printers: '/printers',
  qr: '/qr',
  agent: '/agent',
  pricing: '/pricing',
  staff: '/staff',
  payments: '/payments',
  'college-free-printing': '/college-free-printing',
  services: '/services',
  analytics: '/analytics',
  settings: '/settings',
  support: '/support',
});

export function getShopTabFromPath(pathname) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return Object.entries(SHOP_TAB_PATHS).find(([, path]) => path === normalized)?.[0] || 'overview';
}

export function getShopPathForTab(tab) {
  return SHOP_TAB_PATHS[tab] || SHOP_TAB_PATHS.overview;
}

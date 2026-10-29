export const ADMIN_TAB_PATHS = Object.freeze({
  overview: '/',
  leads: '/leads',
  partners: '/partners',
  tickets: '/tickets',
  shops: '/shops',
  'add-shop': '/shops/new',
  agents: '/agents',
  plans: '/plans',
  pricing: '/pricing',
  gateways: '/gateways',
  navigation: '/website-navigation',
  banners: '/banners',
  diagnostics: '/diagnostics',
  testimonials: '/testimonials',
  'demo-video': '/demo-video',
  statistics: '/statistics',
  coupons: '/coupons',
  legal: '/legal',
  'college-free-printing': '/college-free-printing',
});

export function getAdminTabFromPath(pathname) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return Object.entries(ADMIN_TAB_PATHS).find(([, path]) => path === normalized)?.[0] || 'overview';
}

export function getAdminPathForTab(tab) {
  return ADMIN_TAB_PATHS[tab] || ADMIN_TAB_PATHS.overview;
}

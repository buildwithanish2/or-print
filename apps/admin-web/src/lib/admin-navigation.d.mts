export type AdminTab =
  | 'overview' | 'leads' | 'partners' | 'tickets' | 'shops' | 'add-shop' | 'agents'
  | 'plans' | 'pricing' | 'gateways' | 'navigation' | 'banners' | 'diagnostics'
  | 'testimonials' | 'demo-video' | 'statistics' | 'coupons' | 'legal' | 'college-free-printing';

export const ADMIN_TAB_PATHS: Readonly<Record<AdminTab, string>>;
export function getAdminTabFromPath(pathname: string): AdminTab;
export function getAdminPathForTab(tab: AdminTab): string;

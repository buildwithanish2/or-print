export type ShopDashboardTab =
  | 'overview' | 'queue' | 'orders' | 'printers' | 'qr' | 'agent' | 'pricing' | 'staff'
  | 'payments' | 'college-free-printing' | 'services' | 'analytics' | 'settings' | 'support';

export const SHOP_TAB_PATHS: Readonly<Record<ShopDashboardTab, string>>;
export function getShopTabFromPath(pathname: string): ShopDashboardTab;
export function getShopPathForTab(tab: ShopDashboardTab): string;

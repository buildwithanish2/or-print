import React, { useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardOverview } from './pages/DashboardOverview';
import { LiveQueuePage } from './pages/LiveQueuePage';
import { OrdersPage } from './pages/OrdersPage';
import { PrintersPage } from './pages/PrintersPage';
import { QRStudioPage } from './pages/QRStudioPage';
import { PrintAgentPage } from './pages/PrintAgentPage';
import { PricingServicesPage } from './pages/PricingServicesPage';
import { StaffManagementPage } from './pages/StaffManagementPage';
import { ShopPaymentSettingsPage } from './pages/ShopPaymentSettingsPage';
import { ServicesPage } from './pages/ServicesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ShopSettingsPage } from './pages/ShopSettingsPage';
import { SupportPage } from './pages/SupportPage';
import { CollegeFreePrintingPage } from './pages/CollegeFreePrintingPage';
import { ShopAccountActionPage } from './pages/ShopAccountActionPage';
import { CUSTOMER_PORTAL_URL } from './lib/api';
import {
  LayoutDashboard,
  Clock,
  ShoppingBag,
  Printer,
  QrCode,
  Tag,
  LogOut,
  Store,
  Menu,
  X,
  Laptop,
  Users,
  CreditCard,
  Layers,
  BarChart3,
  Settings,
  LifeBuoy,
} from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<any>(() => {
    const stored = localStorage.getItem('printqr_shop_user');
    return stored ? JSON.parse(stored) : null;
  });

  const [shop, setShop] = useState<any>(() => {
    const stored = localStorage.getItem('printqr_shop_data');
    return stored ? JSON.parse(stored) : null;
  });

  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'queue'
    | 'orders'
    | 'printers'
    | 'qr'
    | 'agent'
    | 'pricing'
    | 'staff'
    | 'payments'
    | 'services'
    | 'analytics'
    | 'settings'
    | 'support'
    | 'college-free-printing'
  >('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const actionPath = window.location.pathname;
  if (actionPath === '/verify-email') return <ShopAccountActionPage mode="verify" />;
  if (actionPath === '/forgot-password') return <ShopAccountActionPage mode="forgot" />;
  if (actionPath === '/reset-password') return <ShopAccountActionPage mode="reset" />;

  const handleLogout = () => {
    localStorage.removeItem('printqr_shop_token');
    localStorage.removeItem('printqr_shop_user');
    localStorage.removeItem('printqr_shop_data');
    setUser(null);
    setShop(null);
  };

  if (!user) {
    return (
      <LoginPage
        onLoginSuccess={(u, s) => {
          setUser(u);
          setShop(s);
        }}
      />
    );
  }

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'queue', label: 'Live Print Queue', icon: Clock, badge: 'Live' },
    { id: 'orders', label: 'Orders History', icon: ShoppingBag },
    { id: 'printers', label: 'Printers & Hardware', icon: Printer },
    { id: 'qr', label: 'My QR Code', icon: QrCode },
    { id: 'agent', label: 'Print Agent', icon: Laptop },
    { id: 'pricing', label: 'Pricing & Rates', icon: Tag },
    { id: 'staff', label: 'Staff Management', icon: Users },
    { id: 'payments', label: 'Payment Settings', icon: CreditCard },
    { id: 'college-free-printing', label: 'College Free Printing', icon: Users },
    { id: 'services', label: 'Services Catalog', icon: Layers },
    { id: 'analytics', label: 'Store Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Store Profile', icon: Settings },
    { id: 'support', label: 'Support & Help', icon: LifeBuoy },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-purple-500 selection:text-white">
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 p-5 flex flex-col justify-between transform transition-transform duration-200 lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="space-y-4 overflow-y-auto pr-1">
            {/* Brand */}
            <div className="flex items-center space-x-3 px-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-base text-white tracking-tight">AnishNova Print</div>
                <div className="text-[11px] text-purple-400 font-medium">Shop Manager</div>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/20'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User Info & Logout */}
          <div className="border-t border-slate-800 pt-4 space-y-3">
            <div className="px-2 flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-purple-400">
                {user.name?.[0] || 'S'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{user.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{shop?.name || user.email}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
          {/* Top Navbar */}
          <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-300"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div className="flex items-center space-x-2">
                <Store className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-sm text-white">{shop?.name || 'ABC Digital Print'}</span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
                  Online
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <a
                href={`${CUSTOMER_PORTAL_URL}/print/${shop?.slug || ''}`}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center space-x-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-600/20 px-3.5 py-1.5 rounded-xl border border-purple-500/30 transition-colors"
              >
                <span>View Customer Portal</span>
              </a>
            </div>
          </header>

          {/* Dynamic Page Content */}
          <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
            {activeTab === 'overview' && <DashboardOverview />}
            {activeTab === 'queue' && <LiveQueuePage />}
            {activeTab === 'orders' && <OrdersPage />}
            {activeTab === 'printers' && <PrintersPage />}
            {activeTab === 'qr' && <QRStudioPage />}
            {activeTab === 'agent' && <PrintAgentPage />}
            {activeTab === 'pricing' && <PricingServicesPage />}
            {activeTab === 'staff' && <StaffManagementPage />}
            {activeTab === 'payments' && <ShopPaymentSettingsPage />}
            {activeTab === 'college-free-printing' && <CollegeFreePrintingPage />}
            {activeTab === 'services' && <ServicesPage />}
            {activeTab === 'analytics' && <AnalyticsPage />}
            {activeTab === 'settings' && <ShopSettingsPage />}
            {activeTab === 'support' && <SupportPage />}
          </main>
        </div>
      </div>

      {/* Footer Attribution */}
      <footer className="lg:pl-64 border-t border-slate-800/80 bg-slate-950 py-3 px-6 text-center text-[11px] text-slate-500">
        Developed by <span className="font-bold text-slate-400">AnishNova Technologies</span>
      </footer>
    </div>
  );
};

export default App;

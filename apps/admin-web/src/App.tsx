import React, { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { PlatformOverview } from './pages/PlatformOverview';
import { ShopsManagement } from './pages/ShopsManagement';
import { AddShopPage } from './pages/AddShopPage';
import { AgentManagementPage } from './pages/AgentManagementPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { GlobalPricingControl } from './pages/GlobalPricingControl';
import { PlatformPaymentGateways } from './pages/PlatformPaymentGateways';
import { TestimonialsManagement } from './pages/TestimonialsManagement';
import { DemoVideoManagement } from './pages/DemoVideoManagement';
import { WebsiteStatisticsPage } from './pages/WebsiteStatisticsPage';
import { WebsiteNavigationPage } from './pages/WebsiteNavigationPage';
import { HomepageBannersPage } from './pages/HomepageBannersPage';
import { SystemDiagnosticsPage } from './pages/SystemDiagnosticsPage';
import { CouponsPage } from './pages/CouponsPage';
import { LeadsManagementPage } from './pages/LeadsManagementPage';
import { PartnersManagementPage } from './pages/PartnersManagementPage';
import { SupportTicketsPage } from './pages/SupportTicketsPage';
import { LegalPagesManagement } from './pages/LegalPagesManagement';
import { CollegeFreePrintingPage } from './pages/CollegeFreePrintingPage';
import { api, CUSTOMER_PORTAL_URL } from './lib/api';
import { AdminTab, getAdminPathForTab, getAdminTabFromPath } from './lib/admin-navigation.mjs';
import { readStoredAdminUser } from './lib/admin-session.mjs';
import {
  Shield,
  LayoutDashboard,
  Store,
  PlusCircle,
  Laptop,
  Layers,
  Tag,
  CreditCard,
  MessageSquareQuote,
  Video,
  Globe,
  Sliders,
  LogOut,
  Menu,
  X,
  Activity,
  Image,
  Navigation,
  Users,
  Handshake,
  LifeBuoy,
  Bell,
  Check,
  FileText,
} from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<any>(() => {
    return readStoredAdminUser();
  });

  const [activeTab, setActiveTab] = useState<AdminTab>(() => getAdminTabFromPath(window.location.pathname));

  const navigateToTab = (tab: AdminTab) => {
    const path = getAdminPathForTab(tab);
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setActiveTab(tab);
  };

  useEffect(() => {
    const restoreTabFromHistory = () => setActiveTab(getAdminTabFromPath(window.location.pathname));
    window.addEventListener('popstate', restoreTabFromHistory);
    return () => window.removeEventListener('popstate', restoreTabFromHistory);
  }, []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/admin/notifications');
      if (res.data.success) {
        setNotifications(res.data.data || []);
        setUnreadNotificationsCount(res.data.unreadCount || 0);
      }
    } catch {}
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 20000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/admin/notifications/all/read');
      setUnreadNotificationsCount(0);
      fetchNotifications();
    } catch {}
  };

  const handleLogout = () => {
    localStorage.removeItem('printqr_admin_token');
    localStorage.removeItem('printqr_admin_user');
    setUser(null);
  };

  if (!user) {
    return <LoginPage onLoginSuccess={(u) => setUser(u)} />;
  }

  const navItems = [
    { id: 'overview', label: 'Platform KPIs', icon: LayoutDashboard },
    { id: 'leads', label: 'Leads & Enquiries', icon: Users, badge: 'CRM' },
    { id: 'partners', label: 'Partner Program', icon: Handshake },
    { id: 'tickets', label: 'Support Tickets', icon: LifeBuoy },
    { id: 'legal', label: 'Legal & Policies', icon: FileText, badge: 'CMS' },
    { id: 'shops', label: 'Shops & Merchants', icon: Store },
    { id: 'add-shop', label: 'Add Shop', icon: PlusCircle, badge: 'New' },
    { id: 'agents', label: 'Print Agent & Fleet', icon: Laptop },
    { id: 'diagnostics', label: 'System Diagnostics', icon: Activity, badge: 'Health' },
    { id: 'plans', label: 'SaaS Plans', icon: Layers },
    { id: 'pricing', label: 'Global Pricing Controls', icon: Sliders },
    { id: 'college-free-printing', label: 'College Free Printing', icon: FileText },
    { id: 'gateways', label: 'Payment Gateways', icon: CreditCard },
    { id: 'navigation', label: 'Website Navigation', icon: Navigation },
    { id: 'banners', label: 'Homepage Banners', icon: Image },
    { id: 'testimonials', label: 'Testimonials', icon: MessageSquareQuote },
    { id: 'demo-video', label: 'Demo Video', icon: Video },
    { id: 'statistics', label: 'Website Statistics', icon: Globe },
    { id: 'coupons', label: 'Promos & Coupons', icon: Tag },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-purple-500 selection:text-white font-sans">
      <div className="flex flex-1">
        {/* Admin Sidebar */}
        {mobileMenuOpen && (
          <button
            type="button"
            aria-label="Close admin navigation menu"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-[2px] lg:hidden"
          />
        )}
        <aside
          id="admin-sidebar"
          aria-label="Super administrator navigation"
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 p-5 flex flex-col justify-between transform transition-transform duration-200 lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="flex items-center space-x-3 px-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-base text-white tracking-tight">AnishNova Print</div>
                <div className="text-[11px] text-purple-400 font-medium">Enterprise Admin</div>
              </div>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      navigateToTab(item.id as AdminTab);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
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

          <div className="border-t border-slate-800 pt-4 space-y-3">
            <div className="px-2 flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-purple-900/50 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-400">
                SA
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{user.name}</div>
                <div className="text-[10px] text-purple-400 truncate">{user.role}</div>
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
          <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-300"
                aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={mobileMenuOpen}
                aria-controls="admin-sidebar"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <span className="font-bold text-sm text-white">Super Administrator Control Center</span>
            </div>

            <div className="flex items-center space-x-3 relative">
              {/* Notifications Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white relative"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-pulse">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 space-y-3 z-50 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-white">Notifications ({notifications.length})</span>
                      {unreadNotificationsCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-[10px] text-purple-400 hover:underline flex items-center space-x-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Mark all read</span>
                        </button>
                      )}
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {notifications.length === 0 ? (
                        <div className="text-center text-slate-500 py-4">No notifications yet.</div>
                      ) : (
                        notifications.slice(0, 15).map((n) => (
                          <div
                            key={n.id}
                            className={`p-2.5 rounded-xl border transition-colors ${
                              n.isRead ? 'bg-slate-950/50 border-slate-800/60' : 'bg-purple-950/30 border-purple-500/30'
                            }`}
                          >
                            <div className="font-bold text-white text-xs">{n.title}</div>
                            <div className="text-slate-400 text-[11px] mt-0.5">{n.message}</div>
                            <div className="text-[9px] text-slate-500 mt-1">
                              {new Date(n.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <a
                href={CUSTOMER_PORTAL_URL}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center space-x-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-600/20 px-3.5 py-1.5 rounded-xl border border-purple-500/30 transition-colors"
              >
                <span>View Public SaaS Portal</span>
              </a>
            </div>
          </header>

          <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
            {activeTab === 'overview' && <PlatformOverview />}
            {activeTab === 'leads' && <LeadsManagementPage />}
            {activeTab === 'partners' && <PartnersManagementPage />}
            {activeTab === 'tickets' && <SupportTicketsPage />}
            {activeTab === 'legal' && <LegalPagesManagement />}
            {activeTab === 'shops' && <ShopsManagement onNavigateToAddShop={() => navigateToTab('add-shop')} />}
            {activeTab === 'add-shop' && <AddShopPage onShopCreated={() => navigateToTab('shops')} />}
            {activeTab === 'agents' && <AgentManagementPage />}
            {activeTab === 'diagnostics' && <SystemDiagnosticsPage />}
            {activeTab === 'plans' && <SubscriptionsPage />}
            {activeTab === 'pricing' && <GlobalPricingControl />}
            {activeTab === 'college-free-printing' && <CollegeFreePrintingPage />}
            {activeTab === 'gateways' && <PlatformPaymentGateways />}
            {activeTab === 'navigation' && <WebsiteNavigationPage />}
            {activeTab === 'banners' && <HomepageBannersPage />}
            {activeTab === 'testimonials' && <TestimonialsManagement />}
            {activeTab === 'demo-video' && <DemoVideoManagement />}
            {activeTab === 'statistics' && <WebsiteStatisticsPage />}
            {activeTab === 'coupons' && <CouponsPage />}
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

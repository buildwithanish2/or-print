import React, { useEffect, useState } from 'react';
import { API_BASE_URL, SHOP_PORTAL_URL } from '../lib/api';
import { resolveAgentRelease, resolvePublicNavigation, resolvePublicPlans } from '../lib/public-home-content.mjs';
import {
  Printer,
  Home,
  QrCode,
  UploadCloud,
  CreditCard,
  Zap,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  FileText,
  Layers,
  Check,
  Star,
  Store,
  Video,
  Play,
  Globe,
  TrendingUp,
  Mail,
  Phone,
  Send,
  X,
  FileCheck,
  Handshake,
  Shield,
  HelpCircle,
  Clock,
  ExternalLink,
  Menu,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Laptop,
  Flame,
  ArrowUpRight,
  Lock,
  Cpu,
  RefreshCw,
  Sliders,
  DollarSign,
  Download,
  WifiOff,
  Palette,
  Timer,
  CheckCircle,
  Building,
  MapPin,
  FileSpreadsheet,
} from 'lucide-react';

const FAQ_ITEMS = [
  {
    q: 'How does contactless QR printing work for customers?',
    a: 'Customers scan the shop QR code, upload a supported document, choose the print options available for that shop, and review the server-calculated price. The order is tracked online. Printing is available after the configured payment or free-print authorization is confirmed.',
  },
  {
    q: 'Do customers need to install any mobile app or use WhatsApp?',
    a: 'Customers can use the QR printing flow in a mobile browser. A customer account is not required for the regular guest order flow where the shop supports it.',
  },
  {
    q: 'How do customer payments work? Can I use my own UPI ID?',
    a: 'Available payment methods depend on the shop configuration. Direct UPI requests may require the shop operator to verify the submitted reference. A UPI app success screen or customer-submitted reference alone does not confirm payment.',
  },
  {
    q: 'What printers and operating systems are supported?',
    a: 'The Windows Print Agent uses printers installed in Windows. Availability and print options depend on the installed driver and the shop’s agent configuration.',
  },
  {
    q: 'How does the Windows Print Agent work?',
    a: 'A shop operator pairs the installed Windows Print Agent with a temporary code from the dashboard, selects a printer, and keeps the agent available. Eligible jobs are delivered to the paired shop. The dashboard reports the status reported by the agent; spooler acceptance does not prove that paper physically came out.',
  },
  {
    q: 'Does the Windows Agent need to be reinstalled when an update is released?',
    a: 'Use the release information and installation instructions shown in the Shop Dashboard. Do not assume silent self-updates are available unless the current release explicitly supports them.',
  },
  {
    q: 'Can I route Color and Black & White prints to different printers?',
    a: 'Print options and printer capabilities are configured for each shop. Separate automatic routing by color mode is not advertised here unless it is explicitly configured and supported by that shop.',
  },
  {
    q: 'Are uploaded documents secure and private?',
    a: 'Documents are handled by the platform’s upload and retention workflow. Avoid uploading sensitive documents unless you are comfortable sharing them with the selected shop; exact deletion timing follows the configured retention policy.',
  },
  {
    q: 'How do I register and start accepting print orders at my shop?',
    a: 'Use Register Your Shop to submit shop details, then follow the account activation and subscription steps shown by the platform. Generate the shop QR and pair the Windows Agent from the Shop Dashboard when those steps are available.',
  },
  {
    q: 'What happens if my shop’s internet goes offline temporarily?',
    a: 'The dashboard and agent need connectivity to exchange job updates. If a connection drops, check the order and agent status before retrying a print so an uncertain job is not printed twice.',
  },
];

const DEFAULT_PUBLIC_NAVIGATION = [
  { id: 'home', label: 'Home', path: '#', icon: Home, iconBg: 'bg-purple-100', iconColor: 'text-purple-700' },
  { id: 'pricing', label: 'Pricing', path: '#pricing', icon: CreditCard, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700' },
  { id: 'how-it-works', label: 'How It Works', path: '#how-it-works', icon: Zap, iconBg: 'bg-amber-100', iconColor: 'text-amber-700' },
  { id: 'features', label: 'Features', path: '#features', icon: Sparkles, iconBg: 'bg-pink-100', iconColor: 'text-pink-700' },
  { id: 'windows-agent', label: 'Windows Agent', path: '#windows-agent', icon: Laptop, iconBg: 'bg-indigo-100', iconColor: 'text-indigo-700' },
];

const safePublicLink = (path: unknown, isExternal: boolean) => {
  if (typeof path !== 'string') return '#';
  const value = path.trim();
  if (!isExternal) return value.startsWith('#') || (value.startsWith('/') && !value.startsWith('//')) ? value : '#';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '#';
  } catch {
    return '#';
  }
};

interface HomePageProps {
  onNavigateToShopRegister: () => void;
  onNavigateToLegal?: (slug: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToShopRegister,
  onNavigateToLegal,
}) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState('');
  const [plansRetry, setPlansRetry] = useState(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [demoVideo, setDemoVideo] = useState<any>(null);
  const [demoVideoVisible, setDemoVideoVisible] = useState(false);
  const [agentRelease, setAgentRelease] = useState<any>(null);
  const [agentReleaseError, setAgentReleaseError] = useState('');
  const [agentReleaseRetry, setAgentReleaseRetry] = useState(0);
  const [contactError, setContactError] = useState('');
  const [partnerError, setPartnerError] = useState('');
  const [publicNavigation, setPublicNavigation] = useState<any[] | null>(null);
  const [homepageBanners, setHomepageBanners] = useState<any[] | null>(null);
  const [stats, setStats] = useState<Record<string, string>>({});

  const [legalPages, setLegalPages] = useState<{ slug: string; title: string }[]>([
    { slug: 'terms', title: 'Terms of Service' },
    { slug: 'privacy', title: 'Privacy Policy' },
    { slug: 'refund-policy', title: 'Refund Policy' },
    { slug: 'contact', title: 'Contact Us' },
  ]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Modals
  const [showContactModal, setShowContactModal] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  // Contact Form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactSubject, setContactSubject] = useState('Website General Inquiry');
  const [contactShopName, setContactShopName] = useState('');
  const [contactCity, setContactCity] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactLeadId, setContactLeadId] = useState<string | null>(null);

  // Partner Form state
  const [partnerName, setPartnerName] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [partnerBusinessName, setPartnerBusinessName] = useState('');
  const [partnerCity, setPartnerCity] = useState('');
  const [partnerState, setPartnerState] = useState('');
  const [partnerPrinterCount, setPartnerPrinterCount] = useState('2');
  const [partnerMonthlyVolume, setPartnerMonthlyVolume] = useState('1000-5000');
  const [partnerMsg, setPartnerMsg] = useState('');
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerLeadId, setPartnerLeadId] = useState<string | null>(null);

  // Scroll detection for sticky header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu or modal is open & handle Escape key
  useEffect(() => {
    if (mobileMenuOpen || showContactModal || showPartnerModal || showVideoModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setShowContactModal(false);
        setShowPartnerModal(false);
        setShowVideoModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen, showContactModal, showPartnerModal, showVideoModal]);

  // Public commercial and operational facts come from the backend; an API
  // failure must not silently substitute sample prices, reviews, or status.
  useEffect(() => {
    let cancelled = false;
    setPlansLoading(true);
    setPlansError('');
    fetch(`${API_BASE_URL}/plans/public`)
      .then((r) => { if (!r.ok) throw new Error('Pricing is temporarily unavailable. Please retry.'); return r.json(); })
      .then((res) => {
        const livePlans = resolvePublicPlans(res.data);
        if (!res.success || !livePlans.length) throw new Error('No active subscription plans are currently published. Please contact us for pricing.');
        if (!cancelled) setPlans(livePlans);
      })
      .catch((error) => { if (!cancelled) { setPlans([]); setPlansError(error.message || 'Pricing is temporarily unavailable. Please retry.'); } })
      .finally(() => { if (!cancelled) setPlansLoading(false); });

    fetch(`${API_BASE_URL}/testimonials/public`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setTestimonials(
            res.data.map((t: any) => ({
              quote: t.review,
              author: t.name,
              role: `${t.role}, ${t.shopName}`,
              rating: t.rating || 5,
              city: t.city,
            }))
          );
        }
      })
      .catch(() => {});

    fetch(`${API_BASE_URL}/statistics/public`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data && typeof res.data === 'object') {
          setStats(res.data);
        }
      })
      .catch(() => {});

    fetch(`${API_BASE_URL}/agents/update/latest`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message || 'Agent release information is temporarily unavailable.');
        return resolveAgentRelease({ data: body });
      })
      .then((release) => { if (!cancelled) { setAgentRelease(release); setAgentReleaseError(''); } })
      .catch((error) => { if (!cancelled) { setAgentRelease(null); setAgentReleaseError(error.message || 'Agent release information is temporarily unavailable.'); } });

    fetch(`${API_BASE_URL}/demo-video/public`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load the public demo video');
        return response.json();
      })
      .then((res) => {
        if (!res?.success) return;
        if (res.data && typeof res.data.videoUrl === 'string' && res.data.videoUrl) {
          setDemoVideo(res.data);
          setDemoVideoVisible(res.data.isActive !== false);
        } else {
          setDemoVideoVisible(false);
        }
      })
      .catch(() => {});

    fetch(`${API_BASE_URL}/navigation/public`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Navigation request failed')))
      .then((res) => {
        if (res?.success) setPublicNavigation(resolvePublicNavigation(res.data, DEFAULT_PUBLIC_NAVIGATION));
      })
      .catch(() => {});

    fetch(`${API_BASE_URL}/banners/public`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Banner request failed')))
      .then((res) => {
        if (res?.success && Array.isArray(res.data)) setHomepageBanners(res.data);
      })
      .catch(() => {});

    // Fetch published legal pages dynamically
    fetch(`${API_BASE_URL}/legal/list/published`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setLegalPages(res.data);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [plansRetry, agentReleaseRetry]);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError('');
    setContactLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inquiries/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          phone: contactPhone,
          shopName: contactShopName,
          city: contactCity,
          subject: contactSubject,
          message: contactMsg,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success !== true) throw new Error(data.message || 'We could not submit your enquiry. Please try again.');
      setContactLeadId(data.leadNumber || 'submitted');
    } catch (error: any) {
      setContactError(error.message || 'We could not submit your enquiry. Please try again.');
    } finally {
      setContactLoading(false);
    }
  };

  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerError('');
    setPartnerLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inquiries/partner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: partnerName,
          email: partnerEmail,
          phone: partnerPhone,
          businessName: partnerBusinessName,
          city: partnerCity,
          state: partnerState,
          printerCount: parseInt(partnerPrinterCount) || 2,
          monthlyVolume: partnerMonthlyVolume,
          message: partnerMsg,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success !== true) throw new Error(data.message || 'We could not submit your partner application. Please try again.');
      setPartnerLeadId(data.partnerNumber || 'submitted');
    } catch (error: any) {
      setPartnerError(error.message || 'We could not submit your partner application. Please try again.');
    } finally {
      setPartnerLoading(false);
    }
  };

  const handleNavClick = (anchor: string) => {
    setMobileMenuOpen(false);
    if (anchor.startsWith('#')) {
      const el = document.querySelector(anchor);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleLegalClick = (slug: string) => {
    setMobileMenuOpen(false);
    if (onNavigateToLegal) {
      onNavigateToLegal(slug);
    } else {
      window.location.href = `/${slug}`;
    }
  };

  const navigationItems = publicNavigation ?? DEFAULT_PUBLIC_NAVIGATION;
  const banner = homepageBanners === null ? undefined : homepageBanners[0];
  const handlePublicNavigation = (event: React.MouseEvent<HTMLAnchorElement>, item: any) => {
    if (!item.isExternal && typeof item.path === 'string' && item.path.startsWith('#')) {
      event.preventDefault();
      handleNavClick(item.path);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#080B20] font-sans selection:bg-purple-500 selection:text-white relative overflow-x-hidden bg-dot-pattern">
      {/* 1. SLIM TOP ANNOUNCEMENT BAR */}
      {(homepageBanners === null || banner) && <div className={`bg-gradient-to-r ${banner?.bgGradient || 'from-purple-700 via-indigo-700 to-pink-600'} text-white text-xs py-2 px-4 text-center font-medium flex items-center justify-center space-x-2`}>
        <span className="truncate">{banner ? <>{banner.title}{banner.subtitle ? ` — ${banner.subtitle}` : ''}</> : '🚀 Launch AnishNova Print at Your Counter — Connect your Windows printer in minutes.'}</span>
        {banner?.ctaText ? (
          <a href={safePublicLink(banner.ctaUrl, /^https?:\/\//i.test(banner.ctaUrl || ''))} target={/^https?:\/\//i.test(banner.ctaUrl || '') ? '_blank' : undefined} rel="noopener noreferrer" onClick={(event) => {
            const target = safePublicLink(banner.ctaUrl, /^https?:\/\//i.test(banner.ctaUrl || ''));
            if (target === '/shop/register' || target === '/register') { event.preventDefault(); onNavigateToShopRegister(); }
            else if (target.startsWith('#')) { event.preventDefault(); handleNavClick(target); }
          }} className="underline font-bold hover:text-amber-200 ml-1 inline-flex items-center flex-shrink-0">{banner.ctaText} →</a>
        ) : !banner ? <button type="button" onClick={onNavigateToShopRegister} className="underline font-bold hover:text-amber-200 ml-1 inline-flex items-center flex-shrink-0"><span>Register Your Shop →</span></button> : null}
      </div>}

      {/* 2. MAIN HEADER NAVBAR (Z-INDEX 1100, SINGLE SOURCE OF TRUTH) */}
      <header
        className={`sticky top-0 z-[1100] h-16 sm:h-18 transition-all duration-300 flex items-center ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-[12px] border-b border-slate-200/90 shadow-sm'
            : 'bg-white/90 backdrop-blur-[8px] border-b border-slate-200/50'
        }`}
      >
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Brand Logo (Only ONCE in header) */}
          <a href="#" className="flex items-center space-x-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center text-white shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform flex-shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-[#080B20] flex items-center">
                AnishNova<span className="text-purple-600 ml-1">Print</span>
              </span>
              <span className="text-[10px] text-slate-500 block -mt-1 font-semibold">
                by AnishNova Technologies
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links (> 768px / lg) */}
          <nav className="hidden lg:flex items-center space-x-7 text-xs font-bold text-slate-700">
            {navigationItems.map((item: any) => <a key={item.id} href={safePublicLink(item.path, Boolean(item.isExternal))} target={item.isExternal && item.openInNewTab ? '_blank' : undefined} rel={item.isExternal && item.openInNewTab ? 'noopener noreferrer' : undefined} onClick={(event) => handlePublicNavigation(event, item)} className="hover:text-purple-600 transition-colors">{item.label}</a>)}
            <button
              type="button"
              onClick={() => {
                setContactLeadId(null);
                setShowContactModal(true);
              }}
              className="hover:text-purple-600 transition-colors"
            >
              Contact
            </button>
          </nav>

          {/* Desktop Action CTAs (> 768px / lg) */}
          <div className="hidden lg:flex items-center space-x-3">
            <button
              type="button"
              onClick={() => {
                setPartnerLeadId(null);
                setShowPartnerModal(true);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-[#080B20] hover:bg-slate-100 transition-all border border-slate-200"
            >
              Partner Program
            </button>
            <a
              href={`${SHOP_PORTAL_URL}/login`}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-[#080B20] hover:bg-slate-100 transition-all border border-slate-200"
            >
              Shop Owner Login
            </a>
            <button
              type="button"
              onClick={onNavigateToShopRegister}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:opacity-95 shadow-md shadow-purple-500/20 flex items-center space-x-1.5 transition-all transform active:scale-95"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Register Your Shop</span>
            </button>
          </div>

          {/* Mobile Menu Button (<= 768px / lg) - Animated Hamburger that toggles to X */}
          <div className="lg:hidden flex items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all focus:outline-none ${
                mobileMenuOpen
                  ? 'bg-purple-600 border border-purple-600 text-white shadow-md shadow-purple-500/25'
                  : 'bg-white border border-slate-200 text-slate-800 hover:text-purple-600 shadow-xs'
              }`}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* 2B. MOBILE BACKDROP (Z-INDEX 1150) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 z-[1150] transition-opacity duration-300 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 2C. MOBILE NAVIGATION DRAWER (Z-INDEX 1200, CRISP 100% OPAQUE WHITE, NO BLUR HAZE) */}
      <aside
        id="mobile-nav-drawer"
        className={`fixed top-0 right-0 h-screen h-[100dvh] w-[min(90vw,390px)] bg-white border-l border-slate-200 shadow-2xl z-[1200] flex flex-col justify-between overflow-y-auto transform transition-transform duration-300 ease-out text-[#080B20] lg:hidden pt-[76px] px-5 pb-[max(20px,env(safe-area-inset-bottom))] ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
        aria-label="Mobile Navigation"
      >
        {/* Navigation Links with Vibrant Pastel Icon Badges */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200/80">
              Quick Navigation
            </span>
            <span className="text-[11px] font-bold text-slate-400">AnishNova Print</span>
          </div>

          {navigationItems.map((item: any, idx: number) => {
            const fallback = DEFAULT_PUBLIC_NAVIGATION[idx % DEFAULT_PUBLIC_NAVIGATION.length];
            const Icon = fallback.icon;
            return (
            <a
              key={item.id || `${item.label}-${idx}`}
              href={safePublicLink(item.path, Boolean(item.isExternal))}
              target={item.isExternal && item.openInNewTab ? '_blank' : undefined}
              rel={item.isExternal && item.openInNewTab ? 'noopener noreferrer' : undefined}
              onClick={(event) => { handlePublicNavigation(event, item); setMobileMenuOpen(false); }}
              className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 active:bg-purple-50/50 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className={`w-9 h-9 rounded-xl ${item.iconBg || fallback.iconBg} ${item.iconColor || fallback.iconColor} flex items-center justify-center flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[15px] font-bold text-slate-800 group-hover:text-purple-700 transition-colors">
                  {item.label}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 transition-colors" />
              </div>
            </a>
          );})}

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setPartnerLeadId(null);
              setShowPartnerModal(true);
            }}
            className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 active:bg-purple-50/50 transition-colors text-left group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Handshake className="w-4 h-4" />
              </div>
              <span className="text-[15px] font-bold text-slate-800 group-hover:text-purple-700 transition-colors">
                Partner Program
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 transition-colors" />
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setContactLeadId(null);
              setShowContactModal(true);
            }}
            className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 active:bg-purple-50/50 transition-colors text-left group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Mail className="w-4 h-4" />
              </div>
              <span className="text-[15px] font-bold text-slate-800 group-hover:text-purple-700 transition-colors">
                Contact Us
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 transition-colors" />
          </button>
        </div>

        {/* Drawer Bottom Actions & Clean Attribution */}
        <div className="pt-4 space-y-2.5 border-t border-slate-100 mt-4">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onNavigateToShopRegister();
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-md shadow-purple-500/20 hover:opacity-95 active:scale-[0.98] transition-all min-h-[50px]"
          >
            <Store className="w-4 h-4" />
            <span>Register Your Shop</span>
          </button>

          <a
            href={`${SHOP_PORTAL_URL}/login`}
            className="w-full py-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-slate-800 font-bold text-sm flex items-center justify-center space-x-2 active:scale-[0.98] transition-all min-h-[50px]"
          >
            <span>Shop Owner Login</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </a>

          <div className="text-center text-[10px] text-slate-400 pt-1 font-medium">
            AnishNova Print • Developed by <strong className="text-slate-600">AnishNova Technologies</strong>
          </div>
        </div>
      </aside>

      {/* 3. HERO SECTION (TWO-COLUMN DESKTOP, STACKED MOBILE) */}
      <section className="pt-8 pb-14 md:pt-14 md:pb-22 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left Column: Brand Label, Headline, 4 Micro Feature Pills, CTAs */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-purple-50 border border-purple-200/80 text-purple-700 text-xs font-black tracking-wider uppercase shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-purple-600 fill-purple-600 flex-shrink-0" />
              <span>ANISHNOVA PRINT • SCAN • UPLOAD • PAY • PRINT</span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-[#080B20] tracking-tight leading-[1.12]">
              Print Documents from <br />
              <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                From Your Phone to the Shop
              </span>
            </h1>

            <p className="text-sm sm:text-base md:text-lg font-bold text-slate-700 max-w-2xl mx-auto lg:mx-0">
              No WhatsApp • No Pendrive • No File Transfer
            </p>

            <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Upload from a mobile browser, review the shop-calculated price, and follow the selected shop’s payment and print-status updates.
            </p>

            {/* 4 Micro Feature Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-left">
              <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
                <div className="w-7 h-7 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <QrCode className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs text-[#080B20]">QR Scan</div>
                <div className="text-[10px] text-slate-500">Scan at counter</div>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
                <div className="w-7 h-7 rounded-xl bg-pink-100 flex items-center justify-center text-pink-700">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs text-[#080B20]">Upload</div>
                <div className="text-[10px] text-slate-500">PDF &amp; Images</div>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
                <div className="w-7 h-7 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs text-[#080B20]">Direct Pay</div>
                <div className="text-[10px] text-slate-500">Shop-configured method</div>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
                <div className="w-7 h-7 rounded-xl bg-orange-100 flex items-center justify-center text-orange-700">
                  <Printer className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs text-[#080B20]">Auto Print</div>
                <div className="text-[10px] text-slate-500">Eligible jobs only</div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
              <a
                href="#pricing"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('#pricing');
                }}
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:opacity-95 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-500/25 flex items-center justify-center space-x-2 transition-all transform active:scale-95 min-h-[48px]"
              >
                <span>See Setup &amp; Pricing ↓</span>
              </a>

              <button
                type="button"
                onClick={onNavigateToShopRegister}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs sm:text-sm border border-slate-300 shadow-sm flex items-center justify-center space-x-2 transition-all min-h-[48px]"
              >
                <Store className="w-4 h-4 text-purple-600" />
                <span>Register Your Shop</span>
              </button>
            </div>
          </div>

          {/* Right Column: Realistic Product Composition */}
          <div className="lg:col-span-5 relative w-full max-w-lg mx-auto">
            <div className="relative p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xl space-y-4">
              {/* Product Card Top Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-rose-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                  PRINTQ WORKFLOW PREVIEW
                </span>
              </div>

              {/* Phone Mockup Component */}
              <div className="p-3.5 rounded-2xl bg-[#FFFDF9] border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 font-bold text-[#080B20]">
                    <Smartphone className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <span>Customer Mobile Screen</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    ILLUSTRATIVE FLOW
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <span className="font-semibold text-slate-800 truncate text-[11px]">sample-document.pdf</span>
                  </div>
                  <span className="font-mono font-bold text-purple-700 flex-shrink-0 ml-2">Price from shop API</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900 text-white space-y-2">
                <div className="flex items-center space-x-2 text-xs font-bold">
                  <Printer className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span>Shop reviews order status</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">UPI references are manually verified by the shop. Agent status reflects reported spooler progress.</p>
              </div>

              {/* Floating Status Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  ✓ Shop-configured options
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  ✓ Server-calculated price
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                  🖨 Windows Printer
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HERO FEATURE STRIP */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto -mt-2 mb-14">
        <div className="p-5 sm:p-7 rounded-3xl bg-white border border-slate-200/90 shadow-md">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            <div className="space-y-1">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="font-bold text-xs sm:text-sm text-[#080B20]">Smart Printing</div>
              <div className="text-[11px] text-slate-500 leading-relaxed">Open the shop’s QR page in a supported mobile browser.</div>
            </div>

            <div className="space-y-1">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                <Laptop className="w-4 h-4" />
              </div>
              <div className="font-bold text-xs sm:text-sm text-[#080B20]">Windows Printers</div>
              <div className="text-[11px] text-slate-500 leading-relaxed">Uses printers installed and selected on the shop’s Windows computer.</div>
            </div>

            <div className="space-y-1">
              <div className="w-8 h-8 rounded-xl bg-pink-50 text-pink-700 flex items-center justify-center font-bold">
                <WifiOff className="w-4 h-4" />
              </div>
              <div className="font-bold text-xs sm:text-sm text-[#080B20]">Shop Agent Connection</div>
              <div className="text-[11px] text-slate-500 leading-relaxed">The shop’s paired Windows Agent must be available to receive jobs.</div>
            </div>

            <div className="space-y-1">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Palette className="w-4 h-4" />
              </div>
              <div className="font-bold text-xs sm:text-sm text-[#080B20]">B&amp;W &amp; Color</div>
              <div className="text-[11px] text-slate-500 leading-relaxed">Available print settings depend on this shop’s printer capabilities.</div>
            </div>

            <div className="col-span-2 sm:col-span-1 space-y-1">
              <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center font-bold">
                <Timer className="w-4 h-4" />
              </div>
              <div className="font-bold text-xs sm:text-sm text-[#080B20]">Setup in Minutes</div>
              <div className="text-[11px] text-slate-500 leading-relaxed">Setup depends on the shop’s account, agent, printer and network.</div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FULL-WIDTH DARK STATISTICS BAR */}
      <section className="bg-[#080B20] text-white py-12 border-y border-purple-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            <div className="space-y-1">
              <div className="text-2xl sm:text-4xl font-black font-mono text-white">{stats.STATS_SHOPS || '—'}</div>
              <div className="text-xs font-semibold text-slate-400">Shops Connected</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-4xl font-black font-mono text-purple-400">{stats.STATS_DOCS || '—'}</div>
              <div className="text-xs font-semibold text-slate-400">Documents Printed</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-4xl font-black font-mono text-pink-400">{stats.STATS_CUSTOMERS || '—'}</div>
              <div className="text-xs font-semibold text-slate-400">Successful Print Jobs</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-4xl font-black font-mono text-amber-400">{stats.STATS_CITIES || '—'}</div>
              <div className="text-xs font-semibold text-slate-400">Available Across India</div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. HOW IT WORKS & DEMO VIDEO */}
      {demoVideoVisible && <section id="how-it-works" className="scroll-mt-24 md:scroll-mt-28 py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <span className="text-xs font-black text-purple-600 uppercase tracking-widest">
            SEE HOW ANISHNOVA PRINT WORKS
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-[#080B20]">
            From QR Scan to Physical Print in Seconds
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Watch our automated cloud-to-spooler architecture in action at an active digital print shop.
          </p>
        </div>

        {/* Video Showcase Card */}
        <div className="max-w-4xl mx-auto rounded-3xl p-2 bg-gradient-to-tr from-purple-600 via-pink-600 to-orange-400 shadow-2xl">
          <div className="relative rounded-2.5xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center group">
            {showVideoModal ? (
              demoVideo.provider === 'DIRECT' ? (
                <video src={demoVideo.videoUrl} title={demoVideo.title} className="w-full h-full" controls autoPlay playsInline />
              ) : (
                <iframe
                  src={demoVideo.videoUrl}
                  title={demoVideo.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )
            ) : (
              <div className="text-center space-y-3 p-4">
                <button
                  type="button"
                  onClick={() => setShowVideoModal(true)}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform mx-auto min-h-[48px]"
                  aria-label="Play Demo Video"
                >
                  <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-white ml-1" />
                </button>
                <div className="text-white font-bold text-sm sm:text-base">{demoVideo.title}</div>
                <div className="text-xs text-slate-400">Click to watch live customer print &amp; spooling</div>
              </div>
            )}
          </div>
        </div>
      </section>
      }

      {/* 7. CUSTOMER TESTIMONIALS */}
      {testimonials.length > 0 && <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto space-y-2 mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-[#080B20] flex items-center justify-center space-x-2">
            <span>⭐ What Shop Owners Say</span>
          </h2>
          <p className="text-xs text-slate-600">
            Real feedback from xerox centers and photocopy shop proprietors using AnishNova Print daily.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex space-x-1 text-amber-400">
                  {[...Array(t.rating || 5)].map((_, r) => (
                    <Star key={r} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-slate-700 italic leading-relaxed">"{t.quote}"</p>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="font-bold text-sm text-[#080B20]">{t.author}</div>
                <div className="text-[11px] text-purple-700 font-semibold">{t.role}</div>
                <div className="text-[10px] text-slate-400">{t.city}</div>
              </div>
            </div>
          ))}
        </div>
      </section>}

      {/* 8. COMPLETE SHOP SYSTEM SECTION */}
      <section id="features" className="scroll-mt-24 md:scroll-mt-28 py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="p-6 sm:p-10 rounded-3xl bg-white border border-slate-200/90 shadow-md space-y-6">
          <div className="max-w-3xl space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-black text-[#080B20]">
              🎁 Not Just Printing — A Complete System for Your Shop
            </h2>
            <p className="text-xs text-slate-600">
              Everything your print counter needs to streamline operations, eliminate queues, and boost daily margins.
            </p>
          </div>

          {/* Feature Chips */}
          <div className="flex flex-wrap gap-2">
            {[
              'QR Printing',
              'Agent print queue',
              'PDF Printing',
              'Image Printing',
              'Color Printing',
              'B&W Printing',
              'Duplex Printing',
              'Custom Pricing',
              'Printer selection',
              'Print Queue',
              'Payment Management',
              'Staff Management',
              'Order Tracking',
              'Analytics',
              'Shop Branding',
              'Windows Print Agent',
            ].map((chip, cIdx) => (
              <span
                key={cIdx}
                className="px-3.5 py-1.5 rounded-2xl bg-purple-50 text-purple-900 border border-purple-200/80 text-xs font-bold shadow-xs"
              >
                {chip}
              </span>
            ))}
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={onNavigateToShopRegister}
              className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-2 transition-all min-h-[48px]"
            >
              <span>Explore All Features →</span>
            </button>
          </div>
        </div>
      </section>

      {/* 9. WINDOWS PRINT AGENT SHOWCASE */}
      <section id="windows-agent" className="scroll-mt-24 md:scroll-mt-28 py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="p-6 sm:p-10 rounded-3xl bg-[#080B20] text-white shadow-2xl border border-purple-900/40">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <span className="text-xs font-black text-purple-400 uppercase tracking-wider">
                WINDOWS DESKTOP SPOOLER
              </span>

              <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">
                Connect Your Windows Printer Automatically.
              </h2>

              <p className="text-xs text-slate-300 leading-relaxed">
                Pair the Windows Print Agent with your shop and select a printer installed on that computer. Release version and download availability are checked from the API.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center space-x-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Shop pairing</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">Use the short-lived pairing code shown in the Shop Dashboard.</p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center space-x-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Windows print queue</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">The agent reports the status available from Windows and the server.</p>
                </div>
              </div>

              <div className="pt-2">
                {agentRelease ? (
                  <a
                    href={`${API_BASE_URL}/admin/agents/download/latest`}
                    className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:opacity-95 text-white font-bold text-xs shadow-lg shadow-purple-500/25 flex items-center space-x-2 inline-flex transition-all min-h-[48px]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Windows Agent v{agentRelease.latestVersion} installer</span>
                  </a>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 text-xs" aria-live="polite">
                    <span className="text-slate-300">{agentReleaseError || 'Checking available Windows Agent release…'}</span>
                    {agentReleaseError && <button type="button" onClick={() => setAgentReleaseRetry((value) => value + 1)} className="underline font-bold text-purple-300">Retry</button>}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 w-full">
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl font-mono text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-purple-400 font-bold">AnishNova Print Agent</span>
                  <span className="text-slate-400 text-[10px] font-bold">VERSION FROM RELEASE API</span>
                </div>
                <div className="space-y-1.5 text-slate-300 text-[11px]">
                  <div>Version: <strong>{agentRelease?.latestVersion || 'Unavailable'}</strong></div>
                  <div>Connection: <strong>Reported by the installed agent</strong></div>
                  <div>Shop and printer: <strong>Shown after pairing in the dashboard</strong></div>
                  <div>Print completion: <strong>Physical output is not inferred from queue acceptance</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10. QR STANDEE SECTION */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="p-6 sm:p-10 rounded-3xl bg-white border border-slate-200/90 shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-3.5 text-center md:text-left">
              <span className="text-xs font-black text-purple-600 uppercase tracking-wider">
                CUSTOM STORE COUNTER ASSET
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-[#080B20]">
                A4 Acrylic Standee Designer
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Export and print high-resolution A4 acrylic standees featuring your store logo, permanent QR identity, and simple 4-step instructions for walk-in customers.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onNavigateToShopRegister}
                  className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center md:justify-start space-x-2 mx-auto md:mx-0 min-h-[48px]"
                >
                  <Store className="w-4 h-4" />
                  <span>Create Your QR Standee</span>
                </button>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="w-52 sm:w-56 p-4 rounded-2xl bg-white border-2 border-slate-850 shadow-2xl text-center space-y-3 font-sans">
                <div className="w-8 h-8 rounded-xl bg-purple-600 mx-auto flex items-center justify-center text-white font-bold text-xs">
                  <Printer className="w-4 h-4" />
                </div>
                <div className="font-black text-xs text-[#080B20]">Your shop name</div>
                <div className="p-3 bg-slate-900 rounded-xl inline-block text-white">
                  <QrCode className="w-20 h-20 sm:w-24 sm:h-24 text-white mx-auto" aria-hidden="true" />
                </div>
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  Illustrative preview · not a scannable shop QR
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 11. DYNAMIC PRICING SECTION (NO DEMO PLAN - REAL PLANS ONLY) */}
      <section id="pricing" className="scroll-mt-24 md:scroll-mt-28 py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <h2 className="text-2xl sm:text-4xl font-black text-[#080B20] flex items-center justify-center space-x-2">
            <span>💰 Choose Your Plan</span>
          </h2>
          <p className="text-xs text-slate-600">Plan names, prices and included features are loaded from the published subscription configuration.</p>

          {/* Monthly / Yearly Billing Toggle */}
          <div className="inline-flex items-center p-1 rounded-2xl bg-white border border-slate-200 text-xs font-bold shadow-xs mt-2">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-xl transition-all ${
                billingCycle === 'monthly' ? 'bg-[#080B20] text-white shadow-sm' : 'text-slate-600 hover:text-[#080B20]'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-1.5 ${
                billingCycle === 'yearly' ? 'bg-[#080B20] text-white shadow-sm' : 'text-slate-600 hover:text-[#080B20]'
              }`}
            >
              <span>Annual Billing</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plansLoading ? (
            <div className="md:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600" role="status">Loading current plans…</div>
          ) : plansError ? (
            <div className="md:col-span-3 rounded-2xl border border-rose-200 bg-white p-6 text-center text-sm text-rose-700" role="alert">
              <p>{plansError}</p>
              <button type="button" onClick={() => setPlansRetry((value) => value + 1)} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 font-bold text-white">Retry pricing</button>
            </div>
          ) : plans.map((plan) => {
            const price = Number(billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly);
            const priceLabel = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(price);
            return (
              <div
                key={plan.id}
                className={`p-6 sm:p-8 rounded-3xl border flex flex-col justify-between transition-all relative ${
                  plan.isPopular
                    ? 'bg-white border-2 border-purple-600 shadow-xl shadow-purple-500/10 md:scale-105 z-10'
                    : 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300'
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-[10px] font-black tracking-wider uppercase text-white shadow-md">
                    MOST POPULAR
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-[#080B20]">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{plan.description}</p>
                  </div>

                  <div className="flex items-baseline space-x-1">
                    <span className="text-3xl sm:text-4xl font-black text-[#080B20] font-mono">₹{priceLabel}</span>
                    <span className="text-xs text-slate-500 font-semibold">/ {billingCycle === 'monthly' ? 'month' : 'year'}</span>
                  </div>

                  <div className="border-t border-slate-100 pt-4 space-y-2.5 text-xs text-slate-700">
                    <div className="font-bold text-[#080B20]">Included features:</div>
                    {Array.isArray(plan.features) &&
                      plan.features.map((feat: string, fIdx: number) => (
                        <div key={fIdx} className="flex items-center space-x-2">
                          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    type="button"
                    onClick={onNavigateToShopRegister}
                    className={`w-full py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center space-x-2 transition-all min-h-[48px] ${
                      plan.isPopular
                        ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white shadow-md hover:opacity-95'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    <span>{plan.ctaText || 'Choose Plan'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 12. PARTNER PROGRAM CTA BANNER */}
      <section className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="p-6 sm:p-10 rounded-3xl bg-[#080B20] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border border-purple-900/40 text-center md:text-left">
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-bold text-white flex items-center justify-center md:justify-start space-x-2">
              <span>🤝 Become an AnishNova Print Partner</span>
            </h3>
            <p className="text-xs text-slate-300">
              Turn your print shop network or university stationery store into a smart contactless printing counter.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setPartnerLeadId(null);
              setShowPartnerModal(true);
            }}
            className="px-6 py-3 rounded-2xl bg-white hover:bg-slate-100 text-[#080B20] font-bold text-xs flex-shrink-0 transition-all min-h-[48px] w-full md:w-auto"
          >
            <span>Become a Partner →</span>
          </button>
        </div>
      </section>

      {/* 13. FAQ ACCORDION */}
      <section id="faq" className="scroll-mt-24 md:scroll-mt-28 py-14 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="text-center space-y-2 mb-10">
          <span className="text-xs font-black text-purple-600 uppercase tracking-widest">
            GOT QUESTIONS?
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-[#080B20]">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-2.5">
          {FAQ_ITEMS.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-white border border-slate-200/90 overflow-hidden transition-all shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between font-bold text-xs sm:text-sm text-[#080B20] hover:text-purple-600 transition-colors min-h-[48px]"
                >
                  <span className="pr-2">{faq.q}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-purple-600 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 14. FINAL CENTERED CTA BANNER */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-r from-purple-700 via-indigo-700 to-pink-600 text-white text-center space-y-4 shadow-2xl">
          <div className="max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Ready to Make Printing Instant?
            </h2>
            <p className="text-xs sm:text-sm text-purple-100 font-medium">
              Connect your printer and start accepting contactless print orders today.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onNavigateToShopRegister}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-[#080B20] font-black text-xs shadow-xl flex items-center justify-center space-x-2 transition-all transform active:scale-95 min-h-[48px]"
            >
              <Store className="w-4 h-4 text-purple-600" />
              <span>Register Your Shop</span>
            </button>
            <a
              href={`${SHOP_PORTAL_URL}/login`}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-[#080B20]/80 hover:bg-[#080B20] text-white font-bold text-xs border border-white/20 flex items-center justify-center min-h-[48px]"
            >
              Shop Owner Login
            </a>
          </div>
        </div>
      </section>

      {/* 15. DYNAMIC FOOTER (LOADS PUBLISHED LEGAL PAGES) */}
      <footer className="border-t border-slate-200 bg-white pt-12 pb-8 text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 sm:gap-8 pb-8 border-b border-slate-100">
            {/* Brand Col */}
            <div className="col-span-2 space-y-2.5">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white font-bold">
                  <Printer className="w-4 h-4" />
                </div>
                <span className="text-base font-black text-[#080B20]">AnishNova Print</span>
              </div>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                Automated contactless printing platform for xerox centers, college campus printers, and digital print merchants.
              </p>
              <div className="text-[11px] text-slate-600 font-bold">
                Developed by <strong>AnishNova Technologies</strong>
              </div>
            </div>

            {/* Col 1: Product */}
            <div className="space-y-2">
              <div className="font-bold text-[#080B20] uppercase text-[11px] tracking-wider">Product</div>
              <ul className="space-y-1.5">
                <li><a href="#" onClick={(e) => { e.preventDefault(); handleNavClick('#'); }} className="hover:text-purple-600">Home</a></li>
                <li><a href="#features" onClick={(e) => { e.preventDefault(); handleNavClick('#features'); }} className="hover:text-purple-600">Features</a></li>
                <li><a href="#pricing" onClick={(e) => { e.preventDefault(); handleNavClick('#pricing'); }} className="hover:text-purple-600">Pricing</a></li>
                <li><a href="#how-it-works" onClick={(e) => { e.preventDefault(); handleNavClick('#how-it-works'); }} className="hover:text-purple-600">How It Works</a></li>
                <li><a href="#windows-agent" onClick={(e) => { e.preventDefault(); handleNavClick('#windows-agent'); }} className="hover:text-purple-600">Windows Agent</a></li>
              </ul>
            </div>

            {/* Col 2: For Shops */}
            <div className="space-y-2">
              <div className="font-bold text-[#080B20] uppercase text-[11px] tracking-wider">For Shops</div>
              <ul className="space-y-1.5">
                <li><button type="button" onClick={onNavigateToShopRegister} className="hover:text-purple-600 text-left">Register Shop</button></li>
                <li><a href={`${SHOP_PORTAL_URL}/login`} className="hover:text-purple-600">Shop Login</a></li>
                <li><button type="button" onClick={() => { setPartnerLeadId(null); setShowPartnerModal(true); }} className="hover:text-purple-600 text-left">Partner Program</button></li>
                <li><a href={`${SHOP_PORTAL_URL}/payments`} className="hover:text-purple-600">Payment Setup</a></li>
              </ul>
            </div>

            {/* Col 3: Company & Dynamic Compliance */}
            <div className="space-y-2">
              <div className="font-bold text-[#080B20] uppercase text-[11px] tracking-wider">Company &amp; Legal</div>
              <ul className="space-y-1.5">
                {legalPages.map((lp) => (
                  <li key={lp.slug}>
                    <button
                      type="button"
                      onClick={() => handleLegalClick(lp.slug)}
                      className="hover:text-purple-600 text-left"
                    >
                      {lp.title}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setContactLeadId(null);
                      setShowContactModal(true);
                    }}
                    className="hover:text-purple-600 text-left"
                  >
                    Contact Us
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-3">
            <div>
              © 2026 AnishNova Print. All rights reserved. Developed by <strong>AnishNova Technologies</strong>.
            </div>
            <div className="flex flex-wrap gap-4">
              {legalPages.map((lp) => (
                <button
                  key={lp.slug}
                  type="button"
                  onClick={() => handleLegalClick(lp.slug)}
                  className="hover:text-slate-700"
                >
                  {lp.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* CONTACT & ENQUIRY MODAL */}
      {showContactModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[1300] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-[#080B20]">Contact AnishNova Technologies</h3>
                <p className="text-[11px] text-slate-500">Send a message to the AnishNova Print team.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="text-slate-400 hover:text-slate-800 p-1"
                aria-label="Close Modal"
              >
                ✕
              </button>
            </div>

              {contactLeadId ? (
              <div className="p-6 text-center text-emerald-700 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" />
                <div className="font-bold text-base">Enquiry Registered Successfully!</div>
                {contactLeadId !== 'submitted' && <p className="text-xs text-slate-600">Your Lead Reference ID is <strong className="font-mono text-purple-700">{contactLeadId}</strong>.</p>}
                <p className="text-[11px] text-slate-500">Our customer success and technical team will contact you shortly.</p>
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="mt-3 px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Your Full Name *</label>
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="e.g. Ramesh Patel"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-purple-600 min-h-[42px]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="ramesh@printshop.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-purple-600 min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Mobile / WhatsApp</label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-purple-600 min-h-[42px]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">City / Location</label>
                    <input
                      type="text"
                      value={contactCity}
                      onChange={(e) => setContactCity(e.target.value)}
                      placeholder="e.g. Pune / Bengaluru"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-purple-600 min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Shop / Business Name</label>
                    <input
                      type="text"
                      value={contactShopName}
                      onChange={(e) => setContactShopName(e.target.value)}
                      placeholder="e.g. Sai Digital Xerox"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-purple-600 min-h-[42px]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Subject *</label>
                    <select
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-purple-600 min-h-[42px]"
                    >
                      <option value="Shop Setup & Registration">Shop Setup &amp; Registration</option>
                      <option value="Windows Agent Installation">Windows Agent Installation</option>
                      <option value="Pricing & Billing Query">Pricing &amp; Billing Query</option>
                      <option value="Custom Enterprise Integration">Custom Enterprise Integration</option>
                      <option value="General Inquiry">General Inquiry</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Message / Question *</label>
                  <textarea
                    required
                    rows={3}
                    value={contactMsg}
                    onChange={(e) => setContactMsg(e.target.value)}
                    placeholder="Describe how we can help your print shop..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-purple-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={contactLoading}
                  className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md min-h-[48px]"
                >
                  {contactLoading ? (
                    <span>Submitting Inquiry...</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Inquiry</span>
                    </>
                  )}
                </button>
                {contactError && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700" role="alert">{contactError}</p>}
              </form>
            )}
          </div>
        </div>
      )}

      {/* PARTNER PROGRAM MODAL */}
      {showPartnerModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[1300] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-[#080B20]">Become an AnishNova Print Partner</h3>
                <p className="text-[11px] text-slate-500">Expand your printing network with high-margin smart counter tech.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPartnerModal(false)}
                className="text-slate-400 hover:text-slate-800 p-1"
                aria-label="Close Modal"
              >
                ✕
              </button>
            </div>

            {partnerLeadId ? (
              <div className="p-6 text-center text-emerald-700 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" />
                <div className="font-bold text-base">Application Received!</div>
                {partnerLeadId !== 'submitted' && <p className="text-xs text-slate-600">Your Partner Reference ID is <strong className="font-mono text-purple-700">{partnerLeadId}</strong>.</p>}
                <p className="text-[11px] text-slate-500">The team will follow up using the contact details you provided.</p>
                <button
                  type="button"
                  onClick={() => setShowPartnerModal(false)}
                  className="mt-3 px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handlePartnerSubmit} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      placeholder="e.g. Vikash Mehta"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-purple-600 min-h-[42px]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Business / Shop Name *</label>
                    <input
                      type="text"
                      required
                      value={partnerBusinessName}
                      onChange={(e) => setPartnerBusinessName(e.target.value)}
                      placeholder="e.g. Metro Digital Xerox Chain"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-purple-600 min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Mobile / WhatsApp *</label>
                    <input
                      type="tel"
                      required
                      value={partnerPhone}
                      onChange={(e) => setPartnerPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-purple-600 min-h-[42px]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={partnerEmail}
                      onChange={(e) => setPartnerEmail(e.target.value)}
                      placeholder="owner@printshop.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-purple-600 min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">City *</label>
                    <input
                      type="text"
                      required
                      value={partnerCity}
                      onChange={(e) => setPartnerCity(e.target.value)}
                      placeholder="e.g. Bengaluru"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-purple-600 min-h-[42px]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">State</label>
                    <input
                      type="text"
                      value={partnerState}
                      onChange={(e) => setPartnerState(e.target.value)}
                      placeholder="e.g. Karnataka"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-purple-600 min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Number of Windows Printers</label>
                    <select
                      value={partnerPrinterCount}
                      onChange={(e) => setPartnerPrinterCount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-purple-600 min-h-[42px]"
                    >
                      <option value="1">1 Printer</option>
                      <option value="2">2 - 3 Printers</option>
                      <option value="5">4 - 6 Printers</option>
                      <option value="10">7+ Printers (High Volume)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Monthly Print Volume</label>
                    <select
                      value={partnerMonthlyVolume}
                      onChange={(e) => setPartnerMonthlyVolume(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-purple-600 min-h-[42px]"
                    >
                      <option value="500-2000">500 - 2,000 pages</option>
                      <option value="2000-10000">2,000 - 10,000 pages</option>
                      <option value="10000-50000">10,000 - 50,000 pages</option>
                      <option value="50000+">50,000+ pages / Month</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Message / Partner Proposal</label>
                  <textarea
                    rows={2}
                    value={partnerMsg}
                    onChange={(e) => setPartnerMsg(e.target.value)}
                    placeholder="Tell us about your printing counter or distribution plan..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus:border-purple-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={partnerLoading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md min-h-[48px]"
                >
                  {partnerLoading ? (
                    <span>Submitting Application...</span>
                  ) : (
                    <>
                      <Handshake className="w-3.5 h-3.5" />
                      <span>Submit Partner Application</span>
                    </>
                  )}
                </button>
                {partnerError && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700" role="alert">{partnerError}</p>}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

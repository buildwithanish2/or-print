import React, { useState, useEffect } from 'react';
import { HomePage } from './pages/HomePage';
import { ShopRegisterPage } from './pages/ShopRegisterPage';
import { CustomerLandingPage } from './pages/CustomerLandingPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { LegalPageView } from './pages/LegalPageView';
import { AuthActionPage } from './pages/AuthActionPage';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Route 1: Order Tracking (/track/:orderNumber)
  if (currentPath === '/verify-email') return <AuthActionPage mode="verify" onNavigate={navigate} />;
  if (currentPath === '/reset-password') return <AuthActionPage mode="reset" onNavigate={navigate} />;
  if (currentPath.startsWith('/track/')) {
    const orderNumber = currentPath.split('/track/')[1]?.split('/')[0] || '';
    const trackingToken = new URLSearchParams(window.location.search).get('token') || '';
    return (
      <OrderTrackingPage
        orderNumber={orderNumber}
        trackingToken={trackingToken}
        onBackToPrint={() => navigate('/print/abc-digital-print')}
      />
    );
  }

  // Route 2: Customer Print Screen (/print/:shopSlug)
  if (currentPath.startsWith('/print/')) {
    const shopSlug = currentPath.split('/print/')[1]?.split('/')[0] || 'abc-digital-print';
    return (
      <CustomerLandingPage
        shopSlug={shopSlug}
        // Build the tracking URL from the two values returned for this order.
        // The optional server URL is informational; using it as navigation
        // state can leave customers with a stale/mismatched tracking token.
        onOrderCreated={(num, token) => navigate(`/track/${encodeURIComponent(num)}?token=${encodeURIComponent(token)}`)}
      />
    );
  }

  // Route 3: Shop Registration Wizard (/shop/register)
  if (currentPath === '/shop/register') {
    return <ShopRegisterPage onBackToHome={() => navigate('/')} />;
  }

  // Route 4: Legal & Policy Compliance Pages (/terms, /privacy, /refund-policy, /contact, /legal/:slug)
  const legalSlugs = ['terms', 'privacy', 'refund-policy', 'contact', 'terms-of-service', 'privacy-policy', 'refunds'];
  const pathClean = currentPath.replace(/^\//, '').toLowerCase();

  if (currentPath.startsWith('/legal/') || legalSlugs.includes(pathClean)) {
    let slug = currentPath.startsWith('/legal/') ? currentPath.split('/legal/')[1]?.split('/')[0] : pathClean;
    if (slug === 'terms-of-service') slug = 'terms';
    if (slug === 'privacy-policy') slug = 'privacy';
    if (slug === 'refunds') slug = 'refund-policy';

    return (
      <LegalPageView
        slug={slug}
        onBack={() => navigate('/')}
        onNavigateToShopRegister={() => navigate('/shop/register')}
      />
    );
  }

  // Route 5: Main SaaS Homepage (/)
  return (
    <HomePage
      onNavigateToShopRegister={() => navigate('/shop/register')}
      onNavigateToPrintDemo={() => navigate('/print/abc-digital-print')}
      onNavigateToLegal={(slug) => navigate(`/${slug}`)}
    />
  );
};

export default App;

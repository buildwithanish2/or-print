import React, { useState, useEffect } from 'react';
import { api, API_BASE_URL, SHOP_PORTAL_URL } from '../lib/api';
import {
  Printer,
  Store,
  CheckCircle2,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Lock,
  CreditCard,
  Mail,
  Zap,
  Star,
  AlertTriangle,
} from 'lucide-react';

interface ShopRegisterPageProps {
  onBackToHome: () => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const ShopRegisterPage: React.FC<ShopRegisterPageProps> = ({ onBackToHome }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Shop & Owner Details
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pin, setPin] = useState('');
  const [country, setCountry] = useState('India');
  const [gst, setGst] = useState('');

  // Step 2: Plans
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Step 3: Payment
  const [selectedGateway, setSelectedGateway] = useState<'RAZORPAY' | 'UPI'>('RAZORPAY');
  const [paymentState, setPaymentState] = useState<'idle' | 'processing' | 'verifying' | 'success'>('idle');

  // Step 4: Success Details
  const [registrationResult, setRegistrationResult] = useState<any>(null);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  // Helper function to safely format prices
  const formatPrice = (priceVal: any): string => {
    const amount = Number(priceVal ?? 0);
    if (!Number.isFinite(amount)) return '₹0';
    return `₹${amount}`;
  };

  // Find currently selected plan object
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || null;

  // Load public plans from backend API
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await api.get('/plans/public');
        const rawPlans = res.data.data || res.data.plans || [];

        if (Array.isArray(rawPlans) && rawPlans.length > 0) {
          const normalized = rawPlans.map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug || p.name.toLowerCase().replace(/\s+/g, '-'),
            description: p.description || '',
            price: Number(p.price ?? p.priceMonthly ?? 0),
            currency: p.currency || 'INR',
            duration: p.duration || 'Lifetime',
            features: Array.isArray(p.features)
              ? p.features
              : typeof p.features === 'string'
              ? JSON.parse(p.features)
              : [],
            isPopular: Boolean(p.isPopular),
            isBestValue: Boolean(p.isBestValue),
          }));

          setPlans(normalized);

          // Check query params for pre-selected plan (e.g. ?plan=starter or ?plan=pro)
          const params = new URLSearchParams(window.location.search);
          const planParam = params.get('plan')?.toLowerCase();

          if (planParam) {
            const match = normalized.find(
              (p: any) => p.slug === planParam || p.id === planParam || p.name.toLowerCase() === planParam
            );
            if (match) {
              setSelectedPlanId(match.id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load plans:', err);
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, []);

  const trackLead = async (stage: string) => {
    try {
      await api.post('/inquiries/shop-lead', {
        shopName,
        ownerName,
        email,
        phone,
        city,
        selectedPlan: selectedPlan?.name,
        step: stage,
      });
    } catch {}
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName || !ownerName || !email || !phone || !password) {
      setError('Please fill in all mandatory fields.');
      return;
    }
    setError(null);
    trackLead('DETAILS_ENTERED');
    setStep(2);
  };

  const handleContinueToPayment = () => {
    if (!selectedPlanId || !selectedPlan) {
      setError('Please select a SaaS plan to continue.');
      return;
    }
    setError(null);
    trackLead('PLAN_SELECTED');

    // If free demo plan (price === 0), register directly
    if (selectedPlan.price === 0) {
      executeRegistration({ planId: selectedPlan.id });
    } else {
      setStep(3);
    }
  };

  /**
   * Final registration execution upon verified payment or demo plan
   */
  const executeRegistration = async (paymentInfo: { planId: string; subscriptionPaymentAttemptId?: string; razorpayOrderId?: string; razorpayPaymentId?: string; razorpaySignature?: string }) => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        shopName,
        ownerName,
        email,
        phone,
        password,
        address,
        city,
        state,
        pin,
        country,
        gst: gst || undefined,
        planId: paymentInfo.planId,
        subscriptionPaymentAttemptId: paymentInfo.subscriptionPaymentAttemptId,
        razorpayOrderId: paymentInfo.razorpayOrderId,
        razorpayPaymentId: paymentInfo.razorpayPaymentId,
        razorpaySignature: paymentInfo.razorpaySignature,
      };

      const res = await api.post('/shops/register', payload);
      if (res.data.success) {
        setRegistrationResult(res.data.data);
        setStep(4);

      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your inputs.');
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Razorpay Script Loader
   */
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  /**
   * Initiates payment for paid SaaS plans
   */
  const handleInitiatePlanPayment = async () => {
    if (!selectedPlan) return;
    setPaymentState('processing');
    setError(null);

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Secure payment checkout could not load. Please try again.');
      }

      const checkoutResponse = await api.post('/payments/subscriptions/create', { planId: selectedPlan.id });
      const checkout = checkoutResponse.data?.data;
      if (!checkout?.attemptId || !checkout?.orderId || !checkout?.keyId || !checkout?.amount) {
        throw new Error(checkoutResponse.data?.message || 'Secure subscription checkout could not be created.');
      }

      const options = {
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        order_id: checkout.orderId,
        name: 'AnishNova Technologies',
        description: `AnishNova Print — ${selectedPlan.name} Plan Activation`,
        prefill: {
          name: ownerName,
          email,
          contact: phone,
        },
        theme: {
          color: '#7c3aed',
        },
        handler: async (response: any) => {
          setPaymentState('verifying');
          try {
            await executeRegistration({
              planId: selectedPlan.id,
              subscriptionPaymentAttemptId: checkout.attemptId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
          } catch (error) {
            setPaymentState('idle');
            setError(error instanceof Error ? error.message : 'Payment verification or registration failed.');
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentState('idle');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        setPaymentState('idle');
        setError(resp.error?.description || 'Payment was cancelled or failed.');
      });
      rzp.open();
    } catch (err: any) {
      setPaymentState('idle');
      setError(err.message || 'Payment initiation error');
    }
  };

  const handleResendEmail = async () => {
    if (!registrationResult?.shop?.id) return;
    setResendingEmail(true);
    setResendStatus(null);
    try {
      const res = await api.post('/auth/resend-verification', { email: registrationResult.email });
      if (res.data.success) setResendStatus('If this account needs verification, a fresh link will be sent.');
    } catch {
      setResendStatus('Failed to resend email. Please try again.');
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col justify-between font-sans">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToHome}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white">
              <Printer className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-sm text-white">AnishNova Print Partner</span>
          </div>
        </div>

        {/* 4-Step Progress Indicators */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
          <div
            className={`p-2.5 rounded-xl border transition-all ${
              step >= 1
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            1. Shop Details
          </div>
          <div
            className={`p-2.5 rounded-xl border transition-all ${
              step >= 2
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            2. Choose Plan
          </div>
          <div
            className={`p-2.5 rounded-xl border transition-all ${
              step >= 3
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            3. Payment
          </div>
          <div
            className={`p-2.5 rounded-xl border transition-all ${
              step === 4
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            4. Shop Ready
          </div>
        </div>

        {/* Main Wizard Card */}
        <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* STEP 1: SHOP & OWNER DETAILS */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-4 text-xs">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white">Register Your Print Shop</h2>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Enter your store and contact information to begin onboarding
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Shop / Center Name *</label>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="e.g. Royal Digital Xerox"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Owner Full Name *</label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Anish Sharma"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@yourprintshop.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Mobile Number (WhatsApp) *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-300 font-bold mb-1">Account Password *</label>
                  <input
                    type="password"
                    required
                    minLength={12}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Use at least 12 characters"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-300 font-bold mb-1">Shop Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Shop No. 4, College Road, Opp. Metro Station"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bengaluru"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Karnataka"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Pincode</label>
                  <input
                    type="text"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="560001"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">GST Number (Optional)</label>
                  <input
                    type="text"
                    value={gst}
                    onChange={(e) => setGst(e.target.value.toUpperCase())}
                    placeholder="29AAAAA0000A1Z5"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white font-bold shadow-lg shadow-purple-500/25 flex items-center space-x-1.5 transition-all transform active:scale-98"
                >
                  <span>Continue to Choose Plan</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: CHOOSE PLAN */}
          {step === 2 && (
            <div className="space-y-6 text-xs">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white">Choose Your SaaS Subscription Plan</h2>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Select a subscription plan that best matches your store volume and printer hardware
                </p>
              </div>

              {loadingPlans ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-400" />
                  <p>Loading available plans from Admin Console...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans.map((p) => {
                    const isSelected = selectedPlanId === p.id;
                    const priceFormatted = formatPrice(p.price);

                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPlanId(p.id)}
                        className={`cursor-pointer p-5 rounded-2xl border transition-all relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/40 shadow-xl shadow-purple-500/10'
                            : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600'
                        }`}
                      >
                        {p.isPopular && (
                          <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-black text-[9px] uppercase tracking-wider shadow-md">
                            Most Popular
                          </div>
                        )}

                        <div className="space-y-3">
                          <div>
                            <h3 className="font-bold text-base text-white">{p.name}</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5 min-h-[28px]">{p.description}</p>
                          </div>

                          <div className="py-2">
                            <span className="text-2xl font-black text-white font-mono">{priceFormatted}</span>
                            <span className="text-[11px] text-slate-400 ml-1">/ {p.duration || 'Lifetime'}</span>
                          </div>

                          <div className="space-y-1.5 pt-2 border-t border-slate-700/50">
                            {p.features?.map((f: string, i: number) => (
                              <div key={i} className="flex items-center space-x-2 text-slate-300">
                                <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                                <span className="text-[11px]">{f}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPlanId(p.id);
                            }}
                            className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                              isSelected
                                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25'
                                : 'bg-slate-800 text-slate-300 hover:text-white'
                            }`}
                          >
                            {isSelected ? '✓ Selected' : `Select ${p.name}`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Selected Plan Summary Banner */}
              {selectedPlan && (
                <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs">
                        Selected: <span className="text-purple-300">{selectedPlan.name} Plan</span> ({formatPrice(selectedPlan.price)} / {selectedPlan.duration || 'Lifetime'})
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {selectedPlan.price === 0 ? 'Free trial access' : 'Full access to automated printing'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Back
                </button>

                <button
                  type="button"
                  disabled={!selectedPlanId}
                  onClick={handleContinueToPayment}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white font-bold shadow-lg shadow-purple-500/25 flex items-center space-x-1.5 transition-all transform active:scale-98 disabled:opacity-40"
                >
                  <span>
                    {selectedPlan?.price === 0
                      ? 'Activate Free Demo'
                      : `Continue to Payment (${formatPrice(selectedPlan?.price || 649)})`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SECURE PAYMENT */}
          {step === 3 && selectedPlan && (
            <div className="space-y-6 text-xs">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white">Secure Checkout &amp; Account Activation</h2>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Complete platform fee payment to automatically activate your shop and receive your Agent pairing credentials
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Order Summary */}
                <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-4">
                  <h3 className="font-bold text-sm text-white">Plan Summary</h3>

                  <div className="space-y-2">
                    <div className="flex justify-between text-slate-300">
                      <span>Shop Name:</span>
                      <span className="font-bold text-white">{shopName}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Selected Plan:</span>
                      <span className="font-bold text-purple-400">{selectedPlan.name}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Billing Duration:</span>
                      <span className="text-slate-300">{selectedPlan.duration || 'Lifetime Access'}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Login Email:</span>
                      <span className="font-mono text-slate-300">{email}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-700 pt-3 space-y-1.5">
                    <div className="flex justify-between text-slate-400">
                      <span>Plan Base Price:</span>
                      <span className="font-mono text-slate-200">{formatPrice(selectedPlan.price)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>GST (Included):</span>
                      <span className="font-mono text-slate-200">₹0.00</span>
                    </div>
                    <div className="border-t border-slate-700/60 pt-2 flex justify-between font-bold text-sm text-white">
                      <span>Total Payable:</span>
                      <span className="text-purple-400 text-base font-mono">{formatPrice(selectedPlan.price)}</span>
                    </div>
                  </div>
                </div>

                {/* Gateway Selector & Trigger */}
                <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h3 className="font-bold text-sm text-white">Select Payment Mode</h3>

                    <button
                      type="button"
                      onClick={() => setSelectedGateway('RAZORPAY')}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
                        selectedGateway === 'RAZORPAY'
                          ? 'bg-purple-600/20 border-purple-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <CreditCard className="w-4 h-4 text-purple-400" />
                        <div className="text-left">
                          <div className="font-bold">UPI / Debit / Credit Cards / NetBanking</div>
                          <div className="text-[10px] text-slate-400">Razorpay 256-bit encrypted</div>
                        </div>
                      </div>
                      {selectedGateway === 'RAZORPAY' && <Check className="w-4 h-4 text-purple-400" />}
                    </button>
                  </div>

                  <div className="space-y-2 pt-4">
                    <button
                      type="button"
                      disabled={paymentState === 'processing' || paymentState === 'verifying' || loading}
                      onClick={handleInitiatePlanPayment}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white font-black text-sm shadow-xl shadow-purple-500/25 flex items-center justify-center space-x-2 transition-all transform active:scale-98 disabled:opacity-50"
                    >
                      {paymentState === 'processing' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Opening Payment Gateway...</span>
                        </>
                      ) : paymentState === 'verifying' || loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Activating Your Shop Account...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>Pay {formatPrice(selectedPlan.price)} &amp; Create Shop</span>
                        </>
                      )}
                    </button>

                    <p className="text-[10px] text-slate-400 text-center">
                      🔒 No charges will be deducted until payment authentication is confirmed.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-start">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Change Plan
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: CONTACT VERIFICATION PENDING */}
          {step === 4 && registrationResult && (
            <div className="space-y-6 text-center max-w-xl mx-auto py-8">
              <div className="w-16 h-16 rounded-3xl bg-blue-500/20 border border-blue-500/30 text-blue-300 flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl md:text-3xl font-black text-white">Verify your shop email</h2>
                <p className="text-sm text-slate-300">{registrationResult.emailSent ? <>A one-time verification link was sent to <strong className="text-white">{registrationResult.email}</strong>.</> : <>Email delivery could not be confirmed for <strong className="text-white">{registrationResult.email}</strong>. Use the resend action after email service is available.</>} Your shop access and QR code stay inactive until you verify.</p>
                <p className="text-xs text-slate-400">Subscription payment status is recorded separately. You can sign in after email verification.</p>
              </div>
              <button type="button" disabled={resendingEmail} onClick={handleResendEmail} className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50">
                {resendingEmail ? 'Sending…' : 'Resend verification link'}
              </button>
              {resendStatus && <p role="status" className="text-sm text-emerald-300">{resendStatus}</p>}
              <a href={`${SHOP_PORTAL_URL}/login`} className="block text-sm text-slate-300 underline">Go to shop sign in</a>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center pt-8 text-[11px] text-slate-500">
        Developed by <span className="font-bold text-slate-400">AnishNova Technologies</span>
      </footer>
    </div>
  );
};

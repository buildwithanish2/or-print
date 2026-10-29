import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ApiRequestError, api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { OrderDTO, PrintJobDTO } from '@printqr/types';
import {
  CheckCircle2,
  Clock,
  Printer,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  QrCode,
  Sparkles,
  Check,
  AlertTriangle,
  Smartphone,
  Copy,
  FileText,
  Send,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Store,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface OrderTrackingPageProps {
  orderNumber: string;
  trackingToken: string;
  onBackToPrint: (shopSlug?: string) => void;
}

const paymentIsSettled = (status?: string) => ['PAID', 'PAYMENT_VERIFIED', 'NOT_REQUIRED'].includes(status || '');

export const OrderTrackingPage: React.FC<OrderTrackingPageProps> = ({ orderNumber, trackingToken, onBackToPrint }) => {
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dynamic UPI Payment State
  const [paymentData, setPaymentData] = useState<any>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [paymentPhase, setPaymentPhase] = useState<
    'IDLE' | 'OPENED_UPI' | 'VERIFYING' | 'SUCCESS' | 'FAILED' | 'EXPIRED'
  >('IDLE');
  const [showManualUtr, setShowManualUtr] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [utrSubmitted, setUtrSubmitted] = useState(false);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [copiedOrder, setCopiedOrder] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes session

  // Polling ref to prevent concurrent or infinite polling
  const pollingTimeouts = useRef<NodeJS.Timeout[]>([]);
  const isPollingActive = useRef(false);

  const clearAllTimeouts = () => {
    pollingTimeouts.current.forEach((t) => clearTimeout(t));
    pollingTimeouts.current = [];
    isPollingActive.current = false;
  };

  const fetchOrder = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get(`/orders/track/${orderNumber}`, { params: { token: trackingToken } });
      if (res.data.success) {
        const orderData: OrderDTO = res.data.data;
        setOrder(orderData);
        if (paymentIsSettled(orderData.paymentStatus)) {
          setPaymentPhase('SUCCESS');
          clearAllTimeouts();
        }
      }
    } catch (err: any) {
      // Temporary production-safe diagnostic: omit the order reference and tracking token.
      console.warn('[order-tracking] lookup failed', {
        status: err instanceof ApiRequestError ? err.status : undefined,
        orderReferencePresent: Boolean(orderNumber),
        trackingTokenPresent: Boolean(trackingToken),
      });
      setError(err.message || 'Order not found');
    } finally {
      setLoading(false);
    }
  }, [orderNumber, trackingToken]);

  const initUpiPayment = async () => {
    setLoadingPayment(true);
    try {
      const res = await api.post('/payments/create', { orderNumber, trackingToken, gateway: 'UPI' });
      if (res.data.success) {
        setPaymentData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to initialize UPI payment session:', err);
    } finally {
      setLoadingPayment(false);
    }
  };

  const handleRazorpayCheckout = async () => {
    setLoadingPayment(true);
    setError(null);
    try {
      if (!(window as any).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Secure checkout could not load. Check your connection and retry.'));
          document.body.appendChild(script);
        });
      }
      const response = await api.post('/payments/create', { orderNumber, trackingToken, gateway: 'RAZORPAY' });
      const checkout = response.data?.data;
      if (!checkout?.key || !checkout?.gatewayOrderId || !checkout?.paymentId || !checkout.amount) {
        throw new Error(response.data?.message || 'This shop’s secure payment checkout is not configured.');
      }
      const razorpay = new (window as any).Razorpay({
        key: checkout.key,
        amount: checkout.amount,
        currency: checkout.currency,
        order_id: checkout.gatewayOrderId,
        name: checkout.shopName || order?.shop?.name || 'Print Shop',
        description: `Print order ${orderNumber}`,
        prefill: { name: order?.customerName || '', contact: order?.customerPhone || '' },
        handler: async (result: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          setPaymentPhase('VERIFYING');
          try {
            await api.post('/payments/verify', {
              paymentId: checkout.paymentId,
              razorpayPaymentId: result.razorpay_payment_id,
              razorpayOrderId: result.razorpay_order_id,
              razorpaySignature: result.razorpay_signature,
            });
            await fetchOrder();
            setPaymentPhase('SUCCESS');
          } catch (error) {
            setPaymentPhase('FAILED');
            setError(error instanceof Error ? error.message : 'Payment verification is still pending. Check the status again shortly.');
          }
        },
        modal: { ondismiss: () => setPaymentPhase('IDLE') },
        theme: { color: '#7c3aed' },
      });
      razorpay.on('payment.failed', (event: any) => {
        setPaymentPhase('FAILED');
        setError(event?.error?.description || 'Payment failed. You can retry from this page.');
      });
      razorpay.open();
    } catch (error) {
      setPaymentPhase('FAILED');
      setError(error instanceof Error ? error.message : 'Could not start payment. Please retry.');
    } finally {
      setLoadingPayment(false);
    }
  };

  // Check payment status from backend with safe intervals
  const checkPaymentStatus = useCallback(async () => {
    try {
      const res = await api.get(`/payments/${orderNumber}/status`, { params: { token: trackingToken } });
      if (res.data.success && res.data.data) {
        const statusData = res.data.data;
        if (statusData.isVerified || paymentIsSettled(statusData.paymentStatus)) {
          setPaymentPhase('SUCCESS');
          clearAllTimeouts();
          confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
          fetchOrder();
          return true;
        }
      }
    } catch (err) {
      console.error('Status check error:', err);
    }
    return false;
  }, [orderNumber, fetchOrder]);

  // Safe backoff polling (immediately, +2s, +4s, +6s, +8s, +12s, +16s, +20s up to 2 mins)
  const startSafeStatusPolling = useCallback(() => {
    if (isPollingActive.current) return;
    isPollingActive.current = true;
    clearAllTimeouts();

    setPaymentPhase('VERIFYING');

    const scheduleCheck = (delayMs: number, nextDelays: number[]) => {
      const timeout = setTimeout(async () => {
        const verified = await checkPaymentStatus();
        if (!verified && nextDelays.length > 0 && isPollingActive.current) {
          scheduleCheck(nextDelays[0], nextDelays.slice(1));
        } else if (!verified && nextDelays.length === 0) {
          isPollingActive.current = false;
        }
      }, delayMs);
      pollingTimeouts.current.push(timeout);
    };

    // Immediate check, then spaced backoff intervals
    scheduleCheck(300, [2000, 4000, 6000, 8000, 12000, 16000, 20000, 25000]);
  }, [checkPaymentStatus]);

  // Initial Load & Socket Setup
  useEffect(() => {
    fetchOrder();

    const socket = getSocket();
    socket.emit('join:order', { orderNumber, trackingToken });

    const handleOrderUpdate = (updatedOrder: OrderDTO) => {
      setOrder(updatedOrder);
      if (paymentIsSettled(updatedOrder.paymentStatus)) {
        setPaymentPhase('SUCCESS');
        clearAllTimeouts();
        confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
      }
      if (updatedOrder.printStatus === 'COMPLETED') {
        confetti({ particleCount: 120, spread: 85, origin: { y: 0.5 } });
      }
    };

    const handlePaymentVerified = () => {
      setPaymentPhase('SUCCESS');
      clearAllTimeouts();
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      fetchOrder();
    };

    const handleJobStatus = (job: PrintJobDTO) => {
      setOrder((prev) => {
        if (!prev) return prev;
        const newPrintStatus =
          job.status === 'COMPLETED'
            ? 'COMPLETED'
            : job.status === 'PRINTING'
            ? 'PRINTING'
            : prev.printStatus;
        return {
          ...prev,
          printStatus: newPrintStatus as any,
        };
      });
    };

    socket.on('order:updated', handleOrderUpdate);
    socket.on('payment:verified', handlePaymentVerified);
    socket.on('job:status', handleJobStatus);

    return () => {
      clearAllTimeouts();
      socket.off('order:updated', handleOrderUpdate);
      socket.off('payment:verified', handlePaymentVerified);
      socket.off('job:status', handleJobStatus);
    };
  }, [orderNumber, fetchOrder]);

  // Listen for window refocus / app return
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !paymentIsSettled(order?.paymentStatus)) {
        startSafeStatusPolling();
      }
    };

    const handleFocus = () => {
      if (!paymentIsSettled(order?.paymentStatus)) {
        startSafeStatusPolling();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [order?.paymentStatus, startSafeStatusPolling]);

  // Load payment details only for manual UPI. Cash remains uncollected until
  // a shop operator confirms it; Razorpay opens only after the customer action.
  useEffect(() => {
    if (order?.paymentMethod === 'UPI' && !paymentIsSettled(order.paymentStatus)) {
      initUpiPayment();
    }
  }, [order?.paymentMethod, order?.paymentStatus]);

  // 10-Minute Expiry Countdown Timer
  useEffect(() => {
    if (!order || paymentIsSettled(order.paymentStatus)) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setPaymentPhase('EXPIRED');
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [order?.paymentStatus]);

  const handlePayWithUpiClick = () => {
    setPaymentPhase('OPENED_UPI');
    // Start safe polling cycle for when customer returns
    startSafeStatusPolling();
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrInput.trim()) return;

    setSubmittingUtr(true);
    try {
      const res = await api.post('/payments/upi/submit-proof', {
        orderNumber,
        trackingToken,
        utrReference: utrInput.trim(),
      });
      if (res.data.success) {
        setUtrSubmitted(true);
        fetchOrder();
        startSafeStatusPolling();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to submit UTR');
    } finally {
      setSubmittingUtr(false);
    }
  };

  const handleCopy = (text: string, type: 'vpa' | 'order') => {
    navigator.clipboard.writeText(text);
    if (type === 'vpa') {
      setCopiedVpa(true);
      setTimeout(() => setCopiedVpa(false), 2500);
    } else {
      setCopiedOrder(true);
      setTimeout(() => setCopiedOrder(false), 2500);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 space-y-4">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-xs text-slate-400 font-medium">Locating your print order...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-400" />
        <h3 className="text-lg font-bold text-white">Order Not Found</h3>
        <p className="text-xs text-slate-400 max-w-xs">{error || 'Could not locate order details.'}</p>
        <button
          type="button"
          onClick={() => onBackToPrint(order?.shop?.slug)}
          className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
        >
          Back to Store
        </button>
      </div>
    );
  }

  const isFreeOrder = order.paymentMethod === 'COLLEGE_FREE' && order.paymentStatus === 'NOT_REQUIRED';
  const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'PAYMENT_VERIFIED' || isFreeOrder || paymentPhase === 'SUCCESS';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 flex flex-col items-center justify-start">
      <div className="w-full max-w-xl space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onBackToPrint(order.shop?.slug)}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Store</span>
          </button>

          <div className="text-right">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Order Reference</span>
            <div className="font-mono font-black text-sm text-purple-400">{order.orderNumber}</div>
          </div>
        </div>

        {/* 1. PAYMENT VERIFIED SUCCESS BANNER */}
        {isPaid && (
          <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-500/40 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isFreeOrder ? 'College free-print eligibility confirmed' : 'Payment Successful &amp; Verified'}</span>
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white">
                  {isFreeOrder ? '₹0.00 · College free print' : `₹${order.totalAmount.toFixed(2)} Paid to ${paymentData?.shopName || order.shop?.name}`}
                </h2>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              {isFreeOrder ? 'Your eligible job was accepted by the existing print queue. This confirms queue acceptance; the print agent reports job completion separately.' : "Your payment has been received and verified. Your document is now being dispatched to the shop's printer spooler!"}
            </p>
          </div>
        )}

        {!isPaid && order.paymentMethod === 'PAY_AT_COUNTER' && (
          <section className="space-y-4 rounded-3xl border border-amber-500/30 bg-slate-900 p-6 text-center shadow-xl md:p-8" aria-labelledby="cash-payment-title">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300"><Store size={26} /></div>
            <h2 id="cash-payment-title" className="text-xl font-black text-white">Pay at the shop</h2>
            <p className="text-sm text-slate-300">Order <span className="font-mono font-bold text-white">{order.orderNumber}</span> is placed. Pay <span className="font-bold text-white">₹{order.totalAmount.toFixed(2)}</span> at the counter. The shop will update payment after collecting cash.</p>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200" role="status">Payment not collected yet · Print status: {order.printStatus.toLowerCase().replace(/_/g, ' ')}</div>
            <button type="button" onClick={() => { fetchOrder(); startSafeStatusPolling(); }} className="mx-auto inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-200 hover:bg-white/5"><RefreshCw size={15} /> Check status</button>
          </section>
        )}

        {!isPaid && order.paymentMethod.startsWith('RAZORPAY') && (
          <section className="space-y-4 rounded-3xl border border-purple-500/30 bg-slate-900 p-6 text-center shadow-xl md:p-8" aria-labelledby="razorpay-payment-title">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300"><ShieldCheck size={26} /></div>
            <h2 id="razorpay-payment-title" className="text-xl font-black text-white">Secure payment to {order.shop?.name || 'the print shop'}</h2>
            <p className="text-sm text-slate-300">Pay ₹{order.totalAmount.toFixed(2)} using the shop’s connected Razorpay account. Your order is confirmed only after the server verifies payment.</p>
            {error && <p role="alert" className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
            <button type="button" disabled={loadingPayment || paymentPhase === 'VERIFYING'} onClick={handleRazorpayCheckout} className="mx-auto flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-50">
              {loadingPayment || paymentPhase === 'VERIFYING' ? <><Loader2 size={17} className="animate-spin" />{paymentPhase === 'VERIFYING' ? 'Verifying payment…' : 'Opening secure checkout…'}</> : <>Pay ₹{order.totalAmount.toFixed(2)} securely<ArrowLeft className="rotate-180" size={16} /></>}
            </button>
            <button type="button" onClick={() => { fetchOrder(); checkPaymentStatus(); }} className="text-xs font-semibold text-purple-300 hover:text-white">Already paid? Check payment status</button>
          </section>
        )}

        {/* Manual UPI payment requires shop-side bank reconciliation. */}
        {!isPaid && order.paymentMethod === 'UPI' && (
          <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-purple-500/30 shadow-2xl space-y-6 text-center">
            {/* Header with Shop Info & Amount */}
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold">
                <Store className="w-3.5 h-3.5 text-purple-400" />
                <span>{paymentData?.shopName || order.shop?.name || 'Print Shop'}</span>
              </div>

              <h2 className="text-3xl font-black text-white pt-1">
                ₹{order.totalAmount.toFixed(2)}
              </h2>

              <p className="text-xs text-slate-400">
                Pay securely using your preferred UPI app • Money goes directly to the shop
              </p>
            </div>

            {/* Dynamic UPI QR Code */}
            <div className="p-4 bg-white rounded-3xl inline-block mx-auto shadow-2xl ring-8 ring-purple-500/10">
              {loadingPayment ? (
                <div className="w-56 h-56 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                </div>
              ) : paymentData?.upiQrDataUrl ? (
                <img
                  src={paymentData.upiQrDataUrl}
                  alt="Dynamic Order UPI QR"
                  className="w-56 h-56 mx-auto rounded-xl"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-500">
                  Generating dynamic order QR...
                </div>
              )}
            </div>

            {/* Supported UPI Apps */}
            <div className="space-y-2">
              <span className="text-[11px] text-slate-400 font-medium">Scan QR with any UPI App:</span>
              <div className="flex justify-center items-center gap-2 flex-wrap text-[11px] font-semibold text-slate-300">
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/60">Google Pay</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/60">PhonePe</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/60">Paytm</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/60">BHIM UPI</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/60">CRED</span>
              </div>
            </div>

            {/* Mobile "Pay with UPI App" Intent Deep-Link */}
            {paymentData?.upiString && (
              <div className="pt-2">
                <a
                  href={paymentData.upiString}
                  onClick={handlePayWithUpiClick}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-500/30 flex items-center justify-center space-x-2 transition-all transform active:scale-95"
                >
                  <Smartphone className="w-5 h-5" />
                  <span>Pay with UPI App (GPay / PhonePe / Paytm)</span>
                </a>
              </div>
            )}

            {/* Quick Copy UPI ID and Order ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Shop UPI ID</div>
                  <div className="font-mono text-xs text-purple-300 font-bold truncate">
                    {paymentData?.shopUpiVpa || 'Shop UPI ID is unavailable'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!paymentData?.shopUpiVpa}
                  onClick={() => paymentData?.shopUpiVpa && handleCopy(paymentData.shopUpiVpa, 'vpa')}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  title="Copy UPI ID"
                >
                  {copiedVpa ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Order Reference</div>
                  <div className="font-mono text-xs text-white font-bold truncate">{order.orderNumber}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(order.orderNumber, 'order')}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Copy Order ID"
                >
                  {copiedOrder ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Live Verification & Session Countdown */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Payment Session Valid For:</span>
                <span className="font-mono font-bold text-amber-400 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  {formatTimer(timeLeft)}
                </span>
              </div>

              {/* Automatic Status Progress Indicator */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2.5 text-xs">
                  {paymentPhase === 'VERIFYING' || paymentPhase === 'OPENED_UPI' ? (
                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin flex-shrink-0" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping flex-shrink-0"></span>
                  )}
                  <span className="text-slate-300">
                    {paymentPhase === 'OPENED_UPI'
                      ? 'Waiting for payment confirmation from UPI app...'
                      : paymentPhase === 'VERIFYING'
                      ? 'Verifying payment with shop counter...'
                      : 'Waiting for payment scan...'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => startSafeStatusPolling()}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Check</span>
                </button>
              </div>

              {/* Manual UTR Fallback Toggle */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualUtr(!showManualUtr)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center space-x-1 mx-auto"
                >
                  <span>Having trouble verifying automatically?</span>
                  {showManualUtr ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showManualUtr && (
                  <div className="mt-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    {utrSubmitted ? (
                      <div className="text-xs text-emerald-400 flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>Reference submitted for manual shop verification. Printing starts after the shop confirms receipt.</span>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmitUtr} className="space-y-2">
                        <label className="block text-[11px] font-bold text-slate-300">
                          Enter your UPI UTR / Reference ID:
                        </label>
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            required
                            value={utrInput}
                            onChange={(e) => setUtrInput(e.target.value.toUpperCase())}
                            placeholder="e.g. 423984729384"
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                          />
                          <button
                            type="submit"
                            disabled={submittingUtr || !utrInput.trim()}
                            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center space-x-1 transition-all disabled:opacity-50"
                          >
                            {submittingUtr ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            <span>Submit</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. ORDER PROGRESS & SPOOLER STATUS */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-base text-white">Live Print Tracking</h3>
              <p className="text-xs text-slate-400">Order #{order.orderNumber}</p>
            </div>

            <div className="text-right">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  order.printStatus === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : order.printStatus === 'PRINTING'
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 animate-pulse'
                    : isPaid
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {order.printStatus === 'COMPLETED'
                  ? '● Completed'
                  : order.printStatus === 'PRINTING'
                  ? '● Printing Now...'
                  : isPaid
                  ? '● Queued at Printer'
                  : '○ Payment Pending'}
              </span>
            </div>
          </div>

          {/* Stepper Progression */}
          <div className="space-y-4 text-xs">
            <div className="flex items-center space-x-3">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center font-bold">
                ✓
              </div>
              <div className="flex-1">
                <div className="font-bold text-white">Document Uploaded &amp; Configured</div>
                <div className="text-slate-500 text-[11px]">
                  {order.totalPages} pages across {order.items?.length || 1} file(s)
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold ${
                  isPaid
                    ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400'
                    : utrSubmitted || paymentPhase === 'VERIFYING'
                    ? 'bg-amber-500/20 border border-amber-500 text-amber-400 animate-pulse'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {isPaid ? '✓' : utrSubmitted ? '●' : '2'}
              </div>
              <div className="flex-1">
                <div className="font-bold text-white">Direct Store UPI Payment Verification</div>
                <div className="text-slate-500 text-[11px]">
                  {isPaid
                    ? 'Payment Verified & Confirmed'
                    : utrSubmitted
                    ? 'Verifying reference with shop counter...'
                    : 'Awaiting payment transfer'}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold ${
                  order.printStatus === 'COMPLETED'
                    ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400'
                    : order.printStatus === 'PRINTING' || order.printStatus === 'QUEUED'
                    ? 'bg-purple-500/20 border border-purple-500 text-purple-400 animate-pulse'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {order.printStatus === 'COMPLETED' ? '✓' : '3'}
              </div>
              <div className="flex-1">
                <div className="font-bold text-white">Windows Spooler &amp; Physical Printing</div>
                <div className="text-slate-500 text-[11px]">
                  {order.printStatus === 'COMPLETED'
                    ? 'All pages printed! Collect your prints at the counter.'
                    : order.printStatus === 'PRINTING'
                    ? 'Printing in progress on Windows Print Spooler...'
                    : isPaid
                    ? 'Job sent to Windows Print Agent...'
                    : 'Waiting for payment confirmation'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. ORDER ITEMS SUMMARY */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Ordered Documents</h4>
          <div className="space-y-2">
            {order.items?.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">{item.file?.originalName}</div>
                    <div className="text-[11px] text-slate-400">
                      {item.selectedPagesCount} pages • {item.colorMode} • {item.copies} copies • {item.duplexMode}
                    </div>
                  </div>
                </div>
                <div className="font-mono font-bold text-purple-300">
                  ₹{item.calculatedPrice.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

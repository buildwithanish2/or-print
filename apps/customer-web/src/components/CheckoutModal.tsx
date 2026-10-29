import React, { useEffect, useState } from 'react';
import { ArrowRight, Banknote, Check, CreditCard, LoaderCircle, QrCode, X } from 'lucide-react';
import { OrderPriceCalculation, PaymentMethod } from '@printqr/types';
import { CustomerPaymentMethod } from '../types/customer';

interface Props { isOpen: boolean; shopName: string; calculation: OrderPriceCalculation; methods: CustomerPaymentMethod[]; submitting: boolean; error?: string | null; onApplyCoupon: (code: string) => Promise<boolean>; onConfirmOrder: (method: PaymentMethod, info: { name: string; phone: string }) => Promise<void>; onClose: () => void; }
export const CheckoutModal: React.FC<Props> = ({ isOpen, shopName, calculation, methods, submitting, error, onApplyCoupon, onConfirmOrder, onClose }) => {
  const [method, setMethod] = useState<PaymentMethod>(methods[0]?.id || 'PAY_AT_COUNTER');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [coupon, setCoupon] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  useEffect(() => { if (methods.length && !methods.some((item) => item.id === method)) setMethod(methods[0].id); }, [methods, method]);
  if (!isOpen) return null;
  const cash = method === 'PAY_AT_COUNTER';
  const razorpay = method === 'RAZORPAY_CARD';
  const handleCoupon = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!coupon.trim() || checkingCoupon) return;
    setCheckingCoupon(true);
    const applied = await onApplyCoupon(coupon.trim().toUpperCase());
    setCouponMessage(applied ? 'Coupon applied.' : 'This coupon is invalid or does not apply to this order.');
    setCheckingCoupon(false);
  };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="checkout-title" className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 bg-[#151619] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl">
      <div className="mb-4 flex items-start justify-between"><div><h2 id="checkout-title" className="text-lg font-bold text-white">Review your order</h2><p className="text-xs text-slate-400">{shopName}</p></div><button aria-label="Close checkout" type="button" disabled={submitting} onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5"><X size={18} /></button></div>
      <div className="mb-4 space-y-2 rounded-xl border border-white/5 bg-black/15 p-3 text-xs"><div className="flex justify-between text-slate-400"><span>Printing subtotal</span><span>₹{calculation.subtotal.toFixed(2)}</span></div>{calculation.totalDiscount > 0 && <div className="flex justify-between text-emerald-300"><span>Discount</span><span>−₹{calculation.totalDiscount.toFixed(2)}</span></div>}<div className="flex justify-between text-slate-400"><span>Service fee</span><span>₹{calculation.serviceFee.toFixed(2)}</span></div><div className="flex justify-between text-slate-400"><span>Tax ({calculation.gstRatePercent}%)</span><span>₹{calculation.gstAmount.toFixed(2)}</span></div><div className="flex justify-between border-t border-white/10 pt-2 text-sm font-bold text-white"><span>Total</span><span>₹{calculation.finalTotal.toFixed(2)}</span></div></div>
      <form onSubmit={handleCoupon} className="mb-4 flex gap-2"><label className="sr-only" htmlFor="coupon-code">Coupon code</label><input id="coupon-code" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code" className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#101114] px-3 text-xs uppercase text-white placeholder:normal-case placeholder:text-slate-500 focus:border-blue-500 focus:outline-none" /><button type="submit" disabled={checkingCoupon || !coupon.trim()} className="rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-200 disabled:opacity-50">{checkingCoupon ? 'Checking…' : 'Apply'}</button></form>{couponMessage && <p role="status" className={`-mt-3 mb-3 text-xs ${couponMessage === 'Coupon applied.' ? 'text-emerald-300' : 'text-rose-300'}`}>{couponMessage}</p>}
      <fieldset className="mb-4"><legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Payment method</legend><div className="space-y-2">{methods.map((item) => { const selected = item.id === method; const Icon = item.id === 'UPI' ? QrCode : item.id === 'RAZORPAY_CARD' ? CreditCard : Banknote; return <button key={item.id} type="button" aria-pressed={selected} disabled={submitting} onClick={() => setMethod(item.id)} className={`flex min-h-12 w-full items-center gap-3 rounded-xl border p-3 text-left ${selected ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-white/10 text-slate-300'}`}><Icon size={18} className="text-blue-300" /><span className="flex-1 text-sm font-medium">{item.label}</span>{selected && <Check size={16} className="text-blue-300" />}</button>; })}</div>{!methods.length && <p className="text-sm text-rose-300">No payment methods are currently available for this shop.</p>}</fieldset>
      <div className="mb-4 grid gap-2 sm:grid-cols-2"><label className="text-xs text-slate-400">Name (optional)<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#101114] px-3 text-sm text-white focus:border-blue-500 focus:outline-none" /></label><label className="text-xs text-slate-400">Phone (optional)<input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#101114] px-3 text-sm text-white focus:border-blue-500 focus:outline-none" /></label></div>
      {error && <p role="alert" className="mb-3 rounded-lg bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
      <button type="button" disabled={submitting || !methods.length} onClick={() => onConfirmOrder(method, { name: name.trim(), phone: phone.trim() })} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50">{submitting ? <><LoaderCircle size={17} className="animate-spin" />Submitting…</> : <>{cash ? 'Submit order · Pay at shop' : razorpay ? `Continue to secure payment · ₹${calculation.finalTotal.toFixed(2)}` : `Continue with UPI · ₹${calculation.finalTotal.toFixed(2)}`}<ArrowRight size={16} /></>}</button>
      <p className="mt-3 text-center text-[11px] text-slate-500">{cash ? 'Payment is collected at the shop; your order stays unpaid until the operator confirms collection.' : razorpay ? 'Payment is processed by this shop’s connected Razorpay account.' : 'UPI payments are manually verified by the shop after you submit the payment reference.'}</p>
    </section>
  </div>;
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Camera, FileText, LoaderCircle, ShieldCheck } from 'lucide-react';
import { FileRecordDTO, OrderPriceCalculation, PaymentMethod, PrintSettingsDTO } from '@printqr/types';
import { Header } from '../components/Header';
import { FileUploader } from '../components/FileUploader';
import { DocumentViewer } from '../components/DocumentViewer';
import { PrintConfigPanel } from '../components/PrintConfigPanel';
import { PriceBreakdownBar } from '../components/PriceBreakdownBar';
import { CheckoutModal } from '../components/CheckoutModal';
import { ApiRequestError, api } from '../lib/api';
import { validatePageRange } from '../lib/pageRange';
import { CustomerPaymentMethod, CustomerShop } from '../types/customer';

interface Props { shopSlug: string; onOrderCreated: (orderNumber: string, trackingToken: string, trackingUrl?: string) => void; }
type CustomerFile = { file: FileRecordDTO; settings: PrintSettingsDTO };

export const CustomerLandingPage: React.FC<Props> = ({ shopSlug, onOrderCreated }) => {
  const [shop, setShop] = useState<CustomerShop | null>(null);
  const [loadingShop, setLoadingShop] = useState(true);
  const [shopError, setShopError] = useState<string | null>(null);
  const [files, setFiles] = useState<CustomerFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileRecordDTO | null>(null);
  const [calculation, setCalculation] = useState<OrderPriceCalculation | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [allowanceError, setAllowanceError] = useState<{ remainingDailyPages: number; remainingMonthlyPages: number; remainingDailyCopies: number; remainingMonthlyCopies: number } | null>(null);
  const [methods, setMethods] = useState<CustomerPaymentMethod[]>([]);
  const [couponCode, setCouponCode] = useState<string | undefined>();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pendingTracking, setPendingTracking] = useState<{ orderNumber: string; trackingToken: string } | null>(null);
  const [customerType, setCustomerType] = useState<'REGULAR' | 'STUDENT' | 'TEACHER'>('REGULAR');
  const [customerUser, setCustomerUser] = useState<any>(null);
  const [freeOptions, setFreeOptions] = useState<any>(null);
  const [guestToken, setGuestToken] = useState('');
  const [guestMessage, setGuestMessage] = useState('');
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [verificationForm, setVerificationForm] = useState({ institutionId: '', requestedRole: 'STUDENT' });
  const [evidence, setEvidence] = useState<File | null>(null);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const requestNumber = useRef(0);
  const orderRequestKey = useRef<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('printqr_customer_token');
    const saved = localStorage.getItem('printqr_customer_user');
    if (token && saved) {
      try { setCustomerUser(JSON.parse(saved)); } catch { localStorage.removeItem('printqr_customer_user'); }
    }
  }, []);

  useEffect(() => {
    setGuestToken(localStorage.getItem(`printqr_free_print_token:${shopSlug}`) || '');
  }, [shopSlug]);

  useEffect(() => {
    let alive = true;
    setLoadingShop(true);
    if (!shopSlug.trim()) {
      setShop(null);
      setShopError('This shop link is missing a valid shop slug. Please scan the QR code provided by the shop.');
      setLoadingShop(false);
      return () => { alive = false; };
    }
    Promise.all([api.get(`/shops/public/${encodeURIComponent(shopSlug)}`), api.get(`/payments/methods/${encodeURIComponent(shopSlug)}`).catch(() => null)])
      .then(([shopRes, methodsRes]) => {
        if (!alive) return;
        const shopData = shopRes?.data?.data;
        if (shopRes?.data?.success !== true
          || !shopData
          || typeof shopData.slug !== 'string'
          || shopData.slug.toLowerCase() !== shopSlug.toLowerCase()) {
          throw new Error(shopRes?.data?.message || 'The shop response was invalid. Please scan the shop QR code again.');
        }
        setShop(shopData as CustomerShop);
        setMethods((methodsRes?.data.data?.methods || []).filter((m: CustomerPaymentMethod) => m.enabled));
        setShopError(null);
      })
      .catch((error: Error) => { if (alive) setShopError(error.message); })
      .finally(() => { if (alive) setLoadingShop(false); });
    return () => { alive = false; };
  }, [shopSlug]);

  useEffect(() => {
    let alive = true;
    api.get(`/free-print/options/${encodeURIComponent(shopSlug)}`)
      .then((res) => { if (alive) { setFreeOptions(res.data.data); setInstitutions(res.data.data.institutions || []); } })
      .catch(() => { if (alive) setFreeOptions(null); });
    return () => { alive = false; };
  }, [shopSlug, customerUser, guestToken]);

  useEffect(() => {
    if (freeOptions?.guestVerification?.status !== 'PENDING') return;
    const timer = window.setInterval(() => {
      api.get(`/free-print/options/${encodeURIComponent(shopSlug)}`).then((res) => setFreeOptions(res.data.data)).catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [freeOptions?.guestVerification?.status, shopSlug]);

  const submitVerification = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!evidence) { setGuestMessage('Take a clear photo of your college ID first.'); return; }
    const form = new FormData();
    form.append('institutionId', verificationForm.institutionId);
    form.append('requestedRole', verificationForm.requestedRole);
    form.append('shopSlug', shopSlug);
    form.append('evidence', evidence);
    setVerificationBusy(true); setGuestMessage('');
    try {
      const submitted = await api.post('/free-print/guest-verification', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const token = submitted.data.data.accessToken as string;
      localStorage.setItem(`printqr_free_print_token:${shopSlug}`, token);
      setGuestToken(token);
      const response = await api.get(`/free-print/options/${encodeURIComponent(shopSlug)}`);
      setFreeOptions(response.data.data); setGuestMessage('ID photo submitted. The shop owner will review it. You can continue with paid printing while you wait.');
      setEvidence(null);
    } catch (error) { setGuestMessage(error instanceof Error ? error.message : 'Verification could not be submitted'); }
    finally { setVerificationBusy(false); }
  };

  const approvedGuest = freeOptions?.guestVerification?.status === 'APPROVED' && freeOptions?.guestVerification?.active;
  const canRequestFree = Boolean(freeOptions?.enabled && freeOptions?.allowance && ((customerUser && customerUser.role === customerType) || (approvedGuest && freeOptions.guestVerification.requestedRole === customerType)));
  const freePrintMode = customerType !== 'REGULAR' && canRequestFree;

  const activeFile = files.find((entry) => entry.file.id === activeFileId);
  const validationErrors = useMemo(() => files.filter(({ file, settings }) => !validatePageRange(settings.pageRange || 'ALL', file.pageCount).valid), [files]);

  useEffect(() => {
    const currentRequest = ++requestNumber.current;
    if (!files.length || validationErrors.length) {
      setCalculation(null);
      setPricingError(validationErrors.length ? 'Fix the page ranges before continuing.' : null);
      setPricingLoading(false);
      return;
    }
    setPricingLoading(true);
    setPricingError(null);
    setAllowanceError(null);
    const timer = window.setTimeout(() => {
      api.post('/pricing/calculate', { shopSlug, items: files.map(({ file, settings }) => ({ fileId: file.id, settings })), couponCode, freePrintRequested: freePrintMode })
        .then((res) => { if (currentRequest === requestNumber.current && res.data.success) setCalculation(res.data.data); })
        .catch((error: Error) => { if (currentRequest === requestNumber.current) { setCalculation(null); setPricingError(error.message); setAllowanceError(error instanceof ApiRequestError && error.code === 'FREE_LIMIT_EXCEEDED' ? error.data as typeof allowanceError : null); } })
        .finally(() => { if (currentRequest === requestNumber.current) setPricingLoading(false); });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [files, shopSlug, validationErrors, couponCode, freePrintMode]);

  const handleFileAdded = useCallback((file: FileRecordDTO) => {
    const caps = shop?.printerCapabilities;
    const paper = caps?.supportedSizes?.find((s) => ['A4', 'A3', 'A5', 'LETTER', 'LEGAL'].includes(s.toUpperCase())) || 'A4';
    const settings: PrintSettingsDTO = { colorMode: 'BW', paperSize: paper as PrintSettingsDTO['paperSize'], orientation: 'PORTRAIT', duplexMode: 'SIMPLEX', copies: 1, pageRange: 'ALL', pagesPerSheet: 1, quality: 'NORMAL', selectedPagesCount: file.pageCount };
    setFiles((prev) => [...prev, { file, settings }]);
    setActiveFileId((current) => current || file.id);
  }, [shop]);
  const updateSettings = (fileId: string, settings: PrintSettingsDTO) => setFiles((prev) => prev.map((entry) => entry.file.id === fileId ? { ...entry, settings } : entry));

  const openTrackingWhenReady = async (orderNumber: string, trackingToken: string) => {
    try {
      const response = await api.get(`/orders/track/${encodeURIComponent(orderNumber)}`, { params: { token: trackingToken } });
      if (response.data?.success !== true || response.data?.data?.orderNumber !== orderNumber) {
        throw new Error('Order tracking is not ready yet.');
      }
      orderRequestKey.current = null;
      setPendingTracking(null);
      setCheckoutError(null);
      onOrderCreated(orderNumber, trackingToken);
      return true;
    } catch {
      setPendingTracking({ orderNumber, trackingToken });
      setCheckoutError('Your order was created, but tracking is not available yet. Retry tracking below; your order will not be submitted again.');
      return false;
    }
  };

  const retryTracking = async () => {
    if (!pendingTracking || submitting) return;
    setSubmitting(true);
    await openTrackingWhenReady(pendingTracking.orderNumber, pendingTracking.trackingToken);
    setSubmitting(false);
  };

  const confirmOrder = async (method: PaymentMethod, customer: { name: string; phone: string }) => {
    if (!shop || !calculation || submitting || pendingTracking) return;
    setSubmitting(true); setCheckoutError(null);
    try {
      if (!orderRequestKey.current) {
        if (!window.crypto?.randomUUID) throw new Error('Secure checkout is unavailable in this browser. Please use a modern browser.');
        orderRequestKey.current = window.crypto.randomUUID();
      }
      const idempotencyKey = orderRequestKey.current;
      orderRequestKey.current = idempotencyKey;
      const res = await api.post('/orders/create', { idempotencyKey, shopSlug: shop.slug, customerName: customer.name || (freePrintMode ? `Verified ${customerType === 'STUDENT' ? 'Student' : 'Teacher'}` : customerUser?.name) || undefined, customerPhone: customer.phone || customerUser?.phone || undefined, paymentMethod: method, freePrintRequested: freePrintMode, couponCode, items: files.map(({ file, settings }) => ({ fileId: file.id, settings })) });
      if (!res.data.success || !res.data.data?.orderNumber || !res.data.data?.trackingToken) throw new Error(res.data.message || 'The order could not be created.');
      setCheckoutOpen(false);
      setPendingTracking({ orderNumber: res.data.data.orderNumber, trackingToken: res.data.data.trackingToken });
      await openTrackingWhenReady(res.data.data.orderNumber, res.data.data.trackingToken);
    } catch (error) { setCheckoutError(error instanceof Error ? error.message : 'The order could not be created. Please try again.'); }
    finally { setSubmitting(false); }
  };

  const applyCoupon = async (code: string) => {
    if (!shop || !files.length || validationErrors.length) return false;
    try {
      const response = await api.post('/pricing/calculate', { shopSlug: shop.slug, items: files.map(({ file, settings }) => ({ fileId: file.id, settings })), couponCode: code, freePrintRequested: freePrintMode });
      const result = response.data.data as OrderPriceCalculation;
      if (!response.data.success || result.totalDiscount <= 0) return false;
      setCouponCode(code);
      setCalculation(result);
      setPricingError(null);
      return true;
    } catch { return false; }
  };

  const removeFile = (id: string) => {
    const remaining = files.filter((entry) => entry.file.id !== id);
    setFiles(remaining);
    if (activeFileId === id) setActiveFileId(remaining[0]?.file.id || null);
  };

  const canCheckout = Boolean(shop?.isOnline && calculation && !pricingLoading && !pricingError && !validationErrors.length && (freePrintMode || methods.length) && !submitting && !uploadBusy && !pendingTracking);
  const continueWithPaidPrinting = () => {
    setCustomerType('REGULAR');
    setPricingError(null);
    setAllowanceError(null);
    setCheckoutError(null);
  };
  const summaryProps = { calculation, loading: pricingLoading, error: pricingError, allowance: allowanceError, disabled: !canCheckout, freePrintMode, onContinueWithPaidPrinting: freePrintMode && pricingError ? continueWithPaidPrinting : undefined, onProceedToCheckout: () => { setCheckoutError(null); if (freePrintMode) void confirmOrder('PAY_AT_COUNTER', { name: customerUser?.name || '', phone: customerUser?.phone || '' }); else setCheckoutOpen(true); } };
  return <div className="min-h-[100dvh] bg-[#0c0d0f] pb-44 font-sans text-slate-100 md:pb-8">
    <Header shop={shop} loading={loadingShop} />
    <main className="mx-auto grid w-full max-w-5xl gap-4 px-3 py-3 sm:px-5 sm:py-5 md:grid-cols-[minmax(0,1fr)_300px] md:gap-5 md:px-6 md:py-6">
      <div className="min-w-0 space-y-3">
        {shopError && <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200"><AlertCircle size={17} />{shopError}</div>}
        {pendingTracking && <div role="alert" className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100"><p>{checkoutError}</p><button type="button" disabled={submitting} onClick={() => void retryTracking()} className="mt-2 min-h-10 rounded-lg border border-amber-300/30 px-3 font-semibold hover:bg-amber-300/10 disabled:opacity-50">{submitting ? 'Checking tracking…' : 'Retry tracking'}</button></div>}
        {shop && !shop.isOnline && <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100"><AlertCircle size={17} />This shop is currently unavailable. Please check with the counter.</div>}
        <section className="rounded-xl border border-white/[.08] bg-[#141518] p-3 sm:p-4" aria-label="Customer category">
          <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-white">Choose your printing type</h2>{customerUser && <span className="text-[11px] text-emerald-300">Signed in</span>}</div>
          <div className="mt-2 grid grid-cols-3 gap-2">{(['REGULAR', 'STUDENT', 'TEACHER'] as const).map((type) => <button key={type} type="button" aria-pressed={customerType === type} onClick={() => { setCustomerType(type); setVerificationForm((v) => ({ ...v, requestedRole: type === 'TEACHER' ? 'TEACHER' : 'STUDENT' })); }} className={`min-h-10 rounded-lg border px-2 text-xs font-semibold ${customerType === type ? 'border-blue-500 bg-blue-500/15 text-blue-200' : 'border-white/10 text-slate-300'}`}>{type === 'REGULAR' ? 'Regular customer' : type}</button>)}</div>
          {customerType !== 'REGULAR' && <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
            {freeOptions?.globalEnabled && !freeOptions?.participating && <p>This shop is not participating in college free printing. You can continue with regular paid printing.</p>}
            {!freeOptions && <p role="status">Checking college free-print availability…</p>}
            {freeOptions && !freeOptions.globalEnabled && <p>College free printing is currently turned off by policy. Regular paid printing remains available. Please check with the shop.</p>}
            {freeOptions?.globalEnabled && !freeOptions.participating && <p>This shop is not participating in college free printing. Regular paid printing remains available.</p>}
            {canRequestFree && <p className="text-emerald-300">Verified {customerType.toLowerCase()} · {freeOptions.allowance.institutionName}. Remaining: {freeOptions.allowance.remainingDailyPages} pages today and {freeOptions.allowance.remainingMonthlyPages} this month.</p>}
            {freeOptions?.verification && customerUser && !canRequestFree && <p className="text-amber-200">Account verification status: {freeOptions.verification.status}. {freeOptions.verification.rejectionReason || 'Use the ID photo review below or continue as a regular customer.'}</p>}
            {approvedGuest && !canRequestFree && <p className="text-amber-200">Your verified ID is approved for {freeOptions.guestVerification.requestedRole.toLowerCase()} printing. Select that category to use free printing, or continue with paid printing.</p>}
            {freeOptions?.guestVerification?.status === 'PENDING' && <p className="text-amber-200">Your ID photo is waiting for the shop owner to review it. Paid printing is still available.</p>}
            {freeOptions?.guestVerification?.status === 'REJECTED' && <p className="text-rose-200">ID photo not approved: {freeOptions.guestVerification.rejectionReason || 'Please speak with the shop owner.'}</p>}
            {freeOptions?.enabled && !approvedGuest && freeOptions?.guestVerification?.status !== 'PENDING' && <form onSubmit={submitVerification} className="mt-3 grid gap-2 sm:grid-cols-2">
              <select required aria-label="Institution" value={verificationForm.institutionId} onChange={(e) => setVerificationForm({ ...verificationForm, institutionId: e.target.value })} className="rounded-lg border border-white/10 bg-[#0c0d0f] px-3 py-2"><option value="">Choose institution</option>{institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}</select>
              <select aria-label="Student or Teacher" value={verificationForm.requestedRole} onChange={(e) => { setVerificationForm({ ...verificationForm, requestedRole: e.target.value }); setCustomerType(e.target.value as 'STUDENT' | 'TEACHER'); }} className="rounded-lg border border-white/10 bg-[#0c0d0f] px-3 py-2"><option value="STUDENT">Student</option><option value="TEACHER">Teacher</option></select>
              <label className="relative flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-blue-400/40 bg-blue-500/[.06] p-3 text-xs text-slate-200 hover:border-blue-400 sm:col-span-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300"><Camera size={19} /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold">Take a live photo of your college ID</span><span className="mt-1 block truncate text-slate-400">{evidence ? `${evidence.name} · ${(evidence.size / 1024 / 1024).toFixed(1)} MB` : 'Camera opens on supported phones · JPG or PNG, up to 5 MB'}</span></span>
                <input required type="file" accept="image/jpeg,image/png" capture="environment" aria-label="Take or choose a photo of your college ID card" onChange={(e) => setEvidence(e.target.files?.[0] || null)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              </label>
              <button disabled={verificationBusy || !institutions.length || !freeOptions.enabled} className="min-h-11 rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">{verificationBusy ? 'Uploading ID photo…' : 'Send ID photo to shop owner'}</button>
            </form>}
            {guestMessage && <p role="status" className="mt-2 text-xs text-slate-300">{guestMessage}</p>}
          </div>}
        </section>
        <section className="rounded-xl border border-white/[.08] bg-[#141518] p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between"><div><h1 className="text-sm font-bold text-white">{files.length ? 'Documents and print options' : 'Start a print order'}</h1><p className="mt-0.5 text-[11px] text-slate-400">{files.length ? 'Choose a document to adjust its settings.' : 'Add one or more files to get started.'}</p></div><ShieldCheck className="text-slate-500" size={17} /></div>
          <FileUploader shopSlug={shopSlug} files={files} disabled={!shop?.isOnline || loadingShop} onBusyChange={setUploadBusy} onFileAdded={handleFileAdded} onFileRemoved={removeFile} onConfigureClick={setActiveFileId} onPreviewClick={setPreviewFile} />
        </section>
        {activeFile && <PrintConfigPanel isOpen fileName={activeFile.file.originalName} totalPages={activeFile.file.pageCount} settings={activeFile.settings} supportedSizes={shop?.printerCapabilities?.supportedSizes} supportsColor={shop?.printerCapabilities?.supportsColor} supportsDuplex={shop?.printerCapabilities?.supportsDuplex} onChange={(settings) => updateSettings(activeFile.file.id, settings)} onClose={() => setActiveFileId(null)} />}
        {files.length > 0 && <div className="flex items-center gap-2 px-1 text-[11px] text-slate-500"><FileText size={13} />Price is recalculated by the shop for every settings change.</div>}
      </div>
      <div className="hidden md:block"><div className="sticky top-24"><PriceBreakdownBar {...summaryProps} /></div></div>
    </main>
    <div className="md:hidden"><PriceBreakdownBar {...summaryProps} /></div>
    {previewFile && <DocumentViewer file={previewFile} onClose={() => setPreviewFile(null)} />}
    {checkoutOpen && calculation && <CheckoutModal isOpen shopName={shop?.name || 'Print shop'} calculation={calculation} methods={methods} submitting={submitting} error={checkoutError} onApplyCoupon={applyCoupon} onConfirmOrder={confirmOrder} onClose={() => setCheckoutOpen(false)} />}
    {submitting && <div className="sr-only" role="status"><LoaderCircle />Submitting order</div>}
  </div>;
};

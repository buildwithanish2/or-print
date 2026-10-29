import React from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { OrderPriceCalculation } from '@printqr/types';

interface Props {
  calculation: OrderPriceCalculation | null;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  freePrintMode?: boolean;
  allowance?: { remainingDailyPages: number; remainingMonthlyPages: number; remainingDailyCopies: number; remainingMonthlyCopies: number } | null;
  onContinueWithPaidPrinting?: () => void;
  onProceedToCheckout: () => void;
}
const money = (n: number) => `₹${Number(n || 0).toFixed(2)}`;
export const PriceBreakdownBar: React.FC<Props> = ({ calculation, loading, error, disabled, freePrintMode, allowance, onContinueWithPaidPrinting, onProceedToCheckout }) => {
  if ((!calculation || calculation.items.length === 0) && !loading && !error) return null;
  if (!calculation || calculation.items.length === 0) return <aside className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#151619]/95 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:static md:rounded-xl md:border md:p-5"><div className="mx-auto max-w-6xl space-y-2 md:max-w-none"><div className="flex items-center justify-between gap-3"><p role={error ? 'alert' : 'status'} className={`text-xs ${error ? 'text-rose-300' : 'text-slate-300'}`}>{error || 'Calculating your price…'}</p>{loading && <LoaderCircle size={16} className="animate-spin text-blue-400" />}</div>{allowance && <p className="text-xs text-slate-400">Remaining free allowance: {allowance.remainingDailyPages} pages today · {allowance.remainingMonthlyPages} this month · {allowance.remainingDailyCopies} copies today · {allowance.remainingMonthlyCopies} this month.</p>}{error && onContinueWithPaidPrinting && <button type="button" onClick={onContinueWithPaidPrinting} className="min-h-11 w-full rounded-xl border border-blue-400/40 px-4 text-sm font-semibold text-blue-200 hover:bg-blue-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300">Continue with paid printing</button>}</div></aside>;
  const pageCount = calculation.items.reduce((sum, item) => sum + (item.selectedPages || 0), 0);
  const copyCount = calculation.items.reduce((sum, item) => sum + (item.copies || 1), 0);
  const sheetCount = calculation.items.reduce((sum, item) => sum + (item.effectiveSheets || 0), 0);
  return <aside aria-label="Payment summary" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#151619]/95 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,.35)] backdrop-blur-xl md:static md:rounded-xl md:border md:p-5 md:shadow-none">
    <div className="mx-auto max-w-6xl md:max-w-none"><div className="mb-2 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 md:text-xs">Payment summary</p><p className="text-xs text-slate-500">{pageCount} pages · {copyCount} {copyCount === 1 ? 'copy' : 'copies'} · {sheetCount} {sheetCount === 1 ? 'sheet' : 'sheets'}</p></div><div className="text-right"><p className="text-[10px] text-slate-400">Total</p><p className="text-lg font-extrabold text-white">{money(calculation.finalTotal)}</p></div></div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-white/5 py-2 text-[11px] md:block md:space-y-1 md:py-3 md:text-xs"><div className="flex justify-between gap-2 text-slate-400"><span>Printing subtotal</span><span>{money(calculation.subtotal)}</span></div>{calculation.totalDiscount > 0 && <div className="flex justify-between gap-2 text-emerald-300"><span>Discount</span><span>−{money(calculation.totalDiscount)}</span></div>}<div className="flex justify-between gap-2 text-slate-400"><span>Service fee</span><span>{money(calculation.serviceFee)}</span></div><div className="flex justify-between gap-2 text-slate-400"><span>Tax ({calculation.gstRatePercent}%)</span><span>{money(calculation.gstAmount)}</span></div></div>
      {error && <p role="alert" className="mb-2 text-xs text-rose-300">{error}</p>}{allowance && <p className="mb-2 text-xs text-slate-400">Remaining free allowance: {allowance.remainingDailyPages} pages today · {allowance.remainingMonthlyPages} this month · {allowance.remainingDailyCopies} copies today · {allowance.remainingMonthlyCopies} this month.</p>}{error && onContinueWithPaidPrinting && <button type="button" onClick={onContinueWithPaidPrinting} className="mb-2 min-h-11 w-full rounded-xl border border-blue-400/40 px-4 text-sm font-semibold text-blue-200 hover:bg-blue-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300">Continue with paid printing</button>}<button type="button" disabled={Boolean(disabled || loading)} onClick={onProceedToCheckout} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 disabled:cursor-not-allowed disabled:opacity-50">{loading ? <><LoaderCircle size={16} className="animate-spin" />Updating price…</> : freePrintMode ? <>Submit free print · ₹0.00 <ArrowRight size={16} /></> : <>Continue to payment · {money(calculation.finalTotal)} <ArrowRight size={16} /></>}</button>
    </div>
  </aside>;
};

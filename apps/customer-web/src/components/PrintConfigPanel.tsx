import React from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import { ColorMode, DuplexMode, PageOrientation, PaperSize, PrintSettingsDTO } from '@printqr/types';
import { validatePageRange } from '../lib/pageRange';

interface Props { isOpen: boolean; fileName: string; totalPages: number; settings: PrintSettingsDTO; onChange: (s: PrintSettingsDTO) => void; onClose: () => void; supportedSizes?: string[]; supportsColor?: boolean; supportsDuplex?: boolean; }
const button = (selected: boolean) => `min-h-11 rounded-lg border px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-400 ${selected ? 'border-blue-500 bg-blue-500/15 text-white' : 'border-white/10 bg-white/[.025] text-slate-300 hover:border-white/20'}`;

export const PrintConfigPanel: React.FC<Props> = ({ isOpen, fileName, totalPages, settings, onChange, onClose, supportedSizes = [], supportsColor = false, supportsDuplex = false }) => {
  if (!isOpen) return null;
  const update = <K extends keyof PrintSettingsDTO>(key: K, value: PrintSettingsDTO[K]) => onChange({ ...settings, [key]: value });
  const range = validatePageRange(settings.pageRange || 'ALL', totalPages);
  const supported = supportedSizes
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().toUpperCase())
    .filter((value): value is PaperSize => ['A4', 'A3', 'A5', 'LETTER', 'LEGAL', 'CUSTOM'].includes(value));
  const sizes = (['A4', 'A3', 'A5', 'LETTER', 'LEGAL', 'CUSTOM'] as PaperSize[])
    .filter((size) => supported.includes(size));
  const selectedPages = settings.pageRange !== 'ALL';
  return <section aria-label={`Print settings for ${fileName}`} className="rounded-xl border border-white/10 bg-[#151619] p-3 sm:p-4">
    <div className="mb-3 flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-sm font-bold text-white">Print settings</h3><p className="truncate text-xs text-slate-400">{fileName} · {totalPages} {totalPages === 1 ? 'page' : 'pages'}</p></div><button type="button" aria-label="Close print settings" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"><X size={16} /></button></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Pages</span>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Pages to print">
          <button type="button" aria-pressed={!selectedPages} className={button(!selectedPages)} onClick={() => update('pageRange', 'ALL')}>All pages ({totalPages})</button>
          <button type="button" aria-pressed={selectedPages} className={button(selectedPages)} onClick={() => { if (!selectedPages) update('pageRange', '1'); }}>Selected pages</button>
        </div>
        {selectedPages && <>
          <label htmlFor="page-range" className="sr-only">Enter page numbers or ranges</label>
          <input id="page-range" value={settings.pageRange} onChange={(e) => update('pageRange', e.target.value)} aria-invalid={!range.valid} aria-describedby="range-help" placeholder="For example: 1-5, 8" className="mt-2 h-11 w-full min-w-0 rounded-lg border border-white/10 bg-[#101114] px-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" />
          <p id="range-help" className={`mt-1 text-[11px] ${range.valid ? 'text-slate-500' : 'text-rose-300'}`} aria-live="polite">{range.valid ? `${range.count} pages selected` : range.message}</p>
        </>}
      </div>
      <div>
        <label htmlFor="print-color" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Print color</label>
        <select id="print-color" value={settings.colorMode} onChange={(e) => update('colorMode', e.target.value as ColorMode)} className="h-11 w-full rounded-lg border border-white/10 bg-[#101114] px-3 text-sm text-white focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
          <option value="BW">Black &amp; white (Monochrome)</option>
          <option value="COLOR" disabled={!supportsColor}>
            {supportsColor ? 'Color' : 'Color (not supported by this printer)'}
          </option>
        </select>
        {!supportsColor && <p className="mt-1 text-[10px] text-slate-500">Color printing is not supported by this shop’s printer.</p>}
      </div>
      <div><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Copies</span><div className="flex h-11 max-w-40 items-center overflow-hidden rounded-lg border border-white/10 bg-[#101114]"><button aria-label="Remove a copy" type="button" disabled={settings.copies <= 1} onClick={() => update('copies', Math.max(1, settings.copies - 1))} className="h-full w-12 text-slate-300 hover:bg-white/5 disabled:opacity-40"><Minus size={16} className="mx-auto" /></button><span aria-live="polite" className="flex-1 text-center font-semibold text-white">{settings.copies}</span><button aria-label="Add a copy" type="button" disabled={settings.copies >= 100} onClick={() => update('copies', Math.min(100, settings.copies + 1))} className="h-full w-12 text-slate-300 hover:bg-white/5 disabled:opacity-40"><Plus size={16} className="mx-auto" /></button></div><p className="mt-1 text-[10px] text-slate-500">Up to 100 copies per document</p></div>
      {sizes.length > 0 && <div><label htmlFor="paper-size" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Paper size</label><select id="paper-size" value={settings.paperSize} onChange={(e) => update('paperSize', e.target.value as PaperSize)} className="h-10 w-full rounded-lg border border-white/10 bg-[#101114] px-3 text-sm text-white">{sizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></div>}
      <div><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Orientation</span><div className="grid grid-cols-2 gap-2"><button type="button" className={button(settings.orientation === 'PORTRAIT')} onClick={() => update('orientation', 'PORTRAIT' as PageOrientation)}>Portrait</button><button type="button" className={button(settings.orientation === 'LANDSCAPE')} onClick={() => update('orientation', 'LANDSCAPE' as PageOrientation)}>Landscape</button></div></div>
      {supportsDuplex && <div><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Print sides</span><div className="grid grid-cols-2 gap-2"><button type="button" className={button(settings.duplexMode === 'SIMPLEX')} onClick={() => update('duplexMode', 'SIMPLEX' as DuplexMode)}>Single-sided</button><button type="button" className={button(settings.duplexMode !== 'SIMPLEX')} onClick={() => update('duplexMode', 'DUPLEX_LONG_EDGE' as DuplexMode)}>Duplex</button></div></div>}
    </div>
  </section>;
};

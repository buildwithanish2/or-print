import React from 'react';
import { MapPin, Phone, Printer } from 'lucide-react';
import { CustomerShop } from '../types/customer';

interface HeaderProps { shop: CustomerShop | null; loading?: boolean; }

export const Header: React.FC<HeaderProps> = ({ shop, loading }) => (
  <header className="sticky top-0 z-30 border-b border-white/5 bg-[#101114]/95 px-4 py-3 backdrop-blur-xl">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><Printer size={19} /></div>
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className="text-xs font-black tracking-wide text-white">OR PRINT</span><span className="text-slate-600">/</span><span className="truncate text-sm font-semibold text-white">{loading ? 'Loading shop…' : shop?.name || 'Print shop'}</span></div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
            {shop?.city && <span className="inline-flex items-center gap-1"><MapPin size={11} />{shop.city}</span>}
            {shop && <span className={shop.isOnline ? 'text-emerald-400' : 'text-amber-300'}>{shop.isOnline ? 'Available now' : 'Currently unavailable'}</span>}
            {shop?.startingPrice != null && <span>From ₹{Number(shop.startingPrice).toFixed(2)}/page</span>}
          </div>
        </div>
      </div>
      {shop?.phone && <a aria-label={`Call ${shop.name}`} href={`tel:${shop.phone}`} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"><Phone size={16} /></a>}
    </div>
  </header>
);

import React, { useState } from 'react';
import { Layers, Check, Sparkles, FileText, Image, CreditCard, Scissors, BookOpen, Scan } from 'lucide-react';

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  price: number;
  isEnabled: boolean;
  icon: any;
}

export const ServicesPage: React.FC = () => {
  const [services, setServices] = useState<ServiceItem[]>([
    { id: '1', name: 'Standard Laser Document Print', category: 'Print', price: 2.0, isEnabled: true, icon: FileText },
    { id: '2', name: 'High Gloss Photo Print (4x6, A4)', category: 'Photo', price: 25.0, isEnabled: true, icon: Image },
    { id: '3', name: 'Biometric 8-in-1 Passport Photos', category: 'Photo', price: 50.0, isEnabled: true, icon: CreditCard },
    { id: '4', name: 'Resume & Project Bond Paper Printing', category: 'Print', price: 10.0, isEnabled: true, icon: FileText },
    { id: '5', name: 'Thermal Document Pouch Lamination', category: 'Finishing', price: 20.0, isEnabled: true, icon: Scissors },
    { id: '6', name: 'Spiral & Hard Cover Book Binding', category: 'Finishing', price: 40.0, isEnabled: true, icon: BookOpen },
    { id: '7', name: '600 DPI High-Resolution Scanning', category: 'Digital', price: 5.0, isEnabled: true, icon: Scan },
  ]);

  const handleToggle = (id: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isEnabled: !s.isEnabled } : s))
    );
  };

  const handlePriceChange = (id: string, newPrice: number) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, price: newPrice } : s))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Layers className="w-5 h-5 text-purple-400" />
            <span>Store Catalog & Service Offerings</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Enable or disable specialized document, photo, binding, and lamination services offered at your store
          </p>
        </div>
      </div>

      {/* Grid of Services */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              className={`p-6 rounded-3xl border transition-all ${
                s.isEnabled
                  ? 'bg-slate-900 border-slate-800 shadow-xl'
                  : 'bg-slate-900/40 border-slate-800/40 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Icon className="w-5 h-5" />
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.isEnabled}
                    onChange={() => handleToggle(s.id)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div className="mt-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">{s.category}</div>
                <h3 className="font-bold text-sm text-white mt-0.5">{s.name}</h3>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Base Price</span>
                <div className="flex items-center space-x-1">
                  <span className="text-slate-500">₹</span>
                  <input
                    type="number"
                    value={s.price}
                    onChange={(e) => handlePriceChange(s.id, Number(e.target.value))}
                    className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-white font-mono text-right"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

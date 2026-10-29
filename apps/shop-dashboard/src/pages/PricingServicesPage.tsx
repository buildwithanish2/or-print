import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Save, Check, RefreshCw, Layers, ShieldCheck, Sparkles, Tag, ArrowRight } from 'lucide-react';
import { PricingRuleDTO } from '@printqr/types';

export const PricingServicesPage: React.FC = () => {
  const [rules, setRules] = useState<PricingRuleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchRules = async () => {
    try {
      const res = await api.get('/pricing/rules');
      if (res.data.success && res.data.data.length > 0) {
        setRules(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load pricing rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handlePriceChange = (index: number, field: keyof PricingRuleDTO, value: any) => {
    setRules((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: Number(value) };
      return copy;
    });
  };

  const handleSaveRule = async (rule: PricingRuleDTO) => {
    setSavingId(rule.paperSize + rule.colorMode);
    setSuccessMsg(null);
    try {
      await api.post('/pricing/rules', rule);
      setSuccessMsg(`Pricing for ${rule.paperSize} (${rule.colorMode}) saved successfully!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save rule');
    } finally {
      setSavingId(null);
    }
  };

  const handleResetToDefaults = async () => {
    if (!confirm('Are you sure you want to reset all rates to Platform Default Pricing?')) return;
    setResetting(true);
    try {
      const res = await api.post('/pricing/rules/reset');
      if (res.data.success) {
        setRules(res.data.data);
        setSuccessMsg('Reset to platform default pricing successfully!');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to reset rules');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading pricing rules...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Tag className="w-5 h-5 text-purple-400" />
            <span>Shop Pricing Engine & Rate Overrides</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Customize per-page print prices, duplex double-sided discounts, and bulk volume rates for your store
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetToDefaults}
          disabled={resetting}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
          <span>Reset to Admin Defaults</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Editable Pricing Matrix Table */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <h3 className="font-bold text-sm text-white">Per-Page & Duplex Rate Matrix</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
              <tr>
                <th className="pb-3">Paper Size</th>
                <th className="pb-3">Color Mode</th>
                <th className="pb-3">Single Side (₹/page)</th>
                <th className="pb-3">Duplex Sheet (₹/sheet)</th>
                <th className="pb-3">Duplex Discount (%)</th>
                <th className="pb-3">Bulk Min Pages</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rules.map((rule, idx) => (
                <tr key={rule.paperSize + rule.colorMode} className="hover:bg-slate-800/30">
                  <td className="py-3 font-bold text-white">{rule.paperSize}</td>
                  <td className="py-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        rule.colorMode === 'COLOR'
                          ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {rule.colorMode === 'COLOR' ? 'Color Laser' : 'Black & White'}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center space-x-1">
                      <span className="text-slate-500">₹</span>
                      <input
                        type="number"
                        step="0.5"
                        value={rule.singleSidePrice}
                        onChange={(e) => handlePriceChange(idx, 'singleSidePrice', e.target.value)}
                        className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono"
                      />
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center space-x-1">
                      <span className="text-slate-500">₹</span>
                      <input
                        type="number"
                        step="0.5"
                        value={rule.duplexPrice}
                        onChange={(e) => handlePriceChange(idx, 'duplexPrice', e.target.value)}
                        className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono"
                      />
                    </div>
                  </td>
                  <td className="py-3">
                    <input
                      type="number"
                      value={rule.duplexDiscountPercent}
                      onChange={(e) => handlePriceChange(idx, 'duplexDiscountPercent', e.target.value)}
                      className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono"
                    />
                    <span className="text-slate-500 ml-1">%</span>
                  </td>
                  <td className="py-3">
                    <input
                      type="number"
                      value={rule.bulkMinPages}
                      onChange={(e) => handlePriceChange(idx, 'bulkMinPages', e.target.value)}
                      className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono"
                    />
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      disabled={savingId === rule.paperSize + rule.colorMode}
                      onClick={() => handleSaveRule(rule)}
                      className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] shadow-sm transition-all"
                    >
                      {savingId === rule.paperSize + rule.colorMode ? 'Saving...' : 'Save'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

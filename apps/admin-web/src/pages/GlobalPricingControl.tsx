import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Tag, Save, Check, ShieldAlert, Sliders } from 'lucide-react';

export const GlobalPricingControl: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    PRICE_CAP_A4_BW: '5.0',
    PRICE_CAP_A4_COLOR: '25.0',
    PLATFORM_SERVICE_FEE: '2.0',
    GST_RATE: '18.0',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/settings');
      if (res.data.success && res.data.data) {
        setSettings((prev) => ({ ...prev, ...res.data.data }));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    try {
      for (const [key, value] of Object.entries(settings)) {
        await api.post('/admin/settings', { key, value });
      }
      setSuccessMsg('Global pricing parameters & caps saved successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save pricing control settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-purple-400" />
            <span>Global Platform Pricing Controls & Price Caps</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure system-wide merchant pricing limits, platform convenience fees, and GST tax percentages
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
            <h3 className="font-bold text-sm text-white">Merchant Price Caps (Max Allowable)</h3>
            <p className="text-[11px] text-slate-400">Shop owners cannot set rates exceeding these platform caps</p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Max A4 B&W Rate (₹/page)</label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.PRICE_CAP_A4_BW || '5.0'}
                  onChange={(e) => handleChange('PRICE_CAP_A4_BW', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Max A4 Color Rate (₹/page)</label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.PRICE_CAP_A4_COLOR || '25.0'}
                  onChange={(e) => handleChange('PRICE_CAP_A4_COLOR', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
            <h3 className="font-bold text-sm text-white">Platform Fees & Taxes</h3>
            <p className="text-[11px] text-slate-400">Applied automatically across all customer print checkouts</p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Platform Convenience Fee (₹/order)</label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.PLATFORM_SERVICE_FEE || '2.0'}
                  onChange={(e) => handleChange('PLATFORM_SERVICE_FEE', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">GST Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.GST_RATE || '18.0'}
                  onChange={(e) => handleChange('GST_RATE', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center space-x-1.5 transition-all shadow-md shadow-purple-500/20"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Global Controls'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

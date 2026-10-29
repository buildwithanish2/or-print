import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { BarChart3, Save, Check, Globe } from 'lucide-react';

export const WebsiteStatisticsPage: React.FC = () => {
  const [stats, setStats] = useState<Record<string, string>>({
    STATS_SHOPS: '450+',
    STATS_DOCS: '1.2M+',
    STATS_CUSTOMERS: '98%',
    STATS_CITIES: '35+',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/settings');
      if (res.data.success && res.data.data) {
        setStats((prev) => ({ ...prev, ...res.data.data }));
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleChange = (key: string, value: string) => {
    setStats((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    try {
      for (const [key, value] of Object.entries(stats)) {
        await api.post('/admin/settings', { key, value });
      }
      setSuccessMsg('Website statistics updated! The public homepage now displays these metrics.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save statistics');
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
            <Globe className="w-5 h-5 text-purple-400" />
            <span>Public Website Metrics & Impact Statistics</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure the live statistics displayed on the public landing page banner
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 font-bold mb-1">Shops Onboarded Display</label>
            <input
              type="text"
              required
              value={stats.STATS_SHOPS || '450+'}
              onChange={(e) => handleChange('STATS_SHOPS', e.target.value)}
              placeholder="e.g. 450+"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Documents Printed Count</label>
            <input
              type="text"
              required
              value={stats.STATS_DOCS || '1.2M+'}
              onChange={(e) => handleChange('STATS_DOCS', e.target.value)}
              placeholder="e.g. 1.2M+"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Happy Customer Rating / %</label>
            <input
              type="text"
              required
              value={stats.STATS_CUSTOMERS || '98%'}
              onChange={(e) => handleChange('STATS_CUSTOMERS', e.target.value)}
              placeholder="e.g. 98%"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Cities & Campuses Served</label>
            <input
              type="text"
              required
              value={stats.STATS_CITIES || '35+'}
              onChange={(e) => handleChange('STATS_CITIES', e.target.value)}
              placeholder="e.g. 35+"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center space-x-1.5 transition-all shadow-md shadow-purple-500/20"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Public Statistics'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

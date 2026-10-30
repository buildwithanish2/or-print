import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Save, Check, Globe, RefreshCw } from 'lucide-react';

export const WebsiteStatisticsPage: React.FC = () => {
  const [stats, setStats] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/settings');
      if (res.data.success && res.data.data) {
        setStats(res.data.data);
        setErrorMsg(null);
      } else {
        setErrorMsg('The server did not return saved website metrics. Retry before editing.');
      }
    } catch {
      setErrorMsg('Could not load saved website metrics. Existing values are unchanged. Check the connection and retry.');
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
    if (['STATS_SHOPS', 'STATS_DOCS', 'STATS_CUSTOMERS', 'STATS_CITIES'].some((key) => !stats[key]?.trim())) {
      setErrorMsg('Fill in all four metric fields before saving.');
      return;
    }
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await api.put('/admin/settings/batch', { settings: Object.fromEntries(['STATS_SHOPS', 'STATS_DOCS', 'STATS_CUSTOMERS', 'STATS_CITIES'].map((key) => [key, stats[key]])) });
      setSuccessMsg('Website statistics updated! The public homepage now displays these metrics.');
    } catch {
      setErrorMsg('Could not save website metrics. No changes were applied; check the connection and retry.');
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
      {errorMsg && <div role="alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-3"><span>{errorMsg}</span><button type="button" onClick={fetchStats} className="inline-flex items-center gap-1 font-bold"><RefreshCw className="w-3.5 h-3.5"/>Retry</button></div>}

      {loading ? <div className="p-8 text-center text-slate-400">Loading saved metrics…</div> : <form onSubmit={handleSave} className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 font-bold mb-1">Shops Onboarded Display</label>
            <input
              type="text"
              required
              value={stats.STATS_SHOPS ?? ''}
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
              value={stats.STATS_DOCS ?? ''}
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
              value={stats.STATS_CUSTOMERS ?? ''}
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
              value={stats.STATS_CITIES ?? ''}
              onChange={(e) => handleChange('STATS_CITIES', e.target.value)}
              placeholder="e.g. 35+"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving || loading}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center space-x-1.5 transition-all shadow-md shadow-purple-500/20"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Public Statistics'}</span>
          </button>
        </div>
      </form>}
    </div>
  );
};

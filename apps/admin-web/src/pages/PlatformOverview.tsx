import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Store, IndianRupee, ShoppingCart, Monitor, Printer, ShieldAlert, TrendingUp, Users } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export const PlatformOverview: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchPlatformMetrics = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/admin/metrics');
      if (!res.data.success || !res.data.data) throw new Error(res.data.message || 'Platform metrics are unavailable.');
      setData(res.data.data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load platform metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchPlatformMetrics(); }, []);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading platform analytics...</div>;
  }

  if (loadError || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-rose-500/20 bg-slate-900 p-6 text-center" role="alert">
        <p className="text-sm font-semibold text-rose-300">Platform overview could not be loaded</p>
        <p className="mt-2 text-xs text-slate-400">{loadError || 'No overview data was returned.'}</p>
        <button type="button" onClick={() => void fetchPlatformMetrics()} className="mt-4 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300">Try again</button>
      </div>
    );
  }

  const { metrics, recentShops, recentOrders, auditLogs } = data;

  const statCards = [
    { title: 'Total Registered Shops', value: metrics.totalShops, icon: Store, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
    { title: 'Active MRR (Est.)', value: `₹${metrics.estimatedMrr.toLocaleString()}`, icon: IndianRupee, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { title: 'Platform Total Orders', value: metrics.totalOrders, icon: ShoppingCart, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { title: 'Online Hardware Printers', value: metrics.onlinePrinters, icon: Printer, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">{card.title}</span>
                <div className={`p-2 rounded-xl border ${card.bg} ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-white">{card.value}</div>
            </div>
          );
        })}
      </div>

      {/* Grid of Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Shops */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
          <h3 className="font-bold text-sm text-white">Recently Onboarded Printing Shops</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="pb-3">Shop Name</th>
                  <th className="pb-3">Owner</th>
                  <th className="pb-3">Printers</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentShops?.map((shop: any) => (
                  <tr key={shop.id} className="hover:bg-slate-800/40">
                    <td className="py-3 font-semibold text-white">{shop.name}</td>
                    <td className="py-3 text-slate-400">{shop.owner?.name}</td>
                    <td className="py-3 text-slate-400">{shop._count?.printers || 0}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {shop.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Logs */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
          <h3 className="font-bold text-sm text-white">Security & System Audit Trail</h3>
          <div className="space-y-2.5 text-xs">
            {auditLogs?.map((log: any) => (
              <div key={log.id} className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-indigo-400">{log.action}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    User: {log.user?.email || 'System'} • {new Date(log.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  {log.ipAddress || 'IP unavailable'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

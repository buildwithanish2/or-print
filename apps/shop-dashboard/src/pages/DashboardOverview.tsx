import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { IndianRupee, ShoppingBag, Clock, CheckCircle, AlertTriangle, Printer, Sparkles, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';

export const DashboardOverview: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/shops/metrics');
      if (!res.data.success || !res.data.data) throw new Error(res.data.message || 'Shop metrics are unavailable.');
      setMetrics(res.data.data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load shop metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchMetrics(); }, []);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading shop overview...</div>;
  }

  if (loadError || !metrics) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-rose-500/20 bg-slate-900 p-6 text-center" role="alert">
        <p className="text-sm font-semibold text-rose-300">Shop overview could not be loaded</p>
        <p className="mt-2 text-xs text-slate-400">{loadError || 'No overview data was returned.'}</p>
        <button type="button" onClick={() => void fetchMetrics()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400">Try again</button>
      </div>
    );
  }

  const statCards = [
    { title: "Today's Revenue", value: `₹${metrics.todayRevenue.toFixed(2)}`, icon: IndianRupee, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { title: "Today's Orders", value: metrics.todayOrdersCount, icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { title: 'Pending Queue', value: metrics.pendingJobsCount, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    { title: 'Active Printers', value: metrics.activePrintersCount, icon: Printer, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  ];

  const pieColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899'];

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Area Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-white">Daily Revenue Trend</h3>
              <p className="text-xs text-slate-400">Order revenue over the last 7 days</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.charts?.revenueTrend || []}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(value: any) => [`₹${value}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Color vs B&W Print Distribution */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-white">Print Mode Split</h3>
            <p className="text-xs text-slate-400">Color vs Monochrome volume</p>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.charts?.printTypeDistribution || []}
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {metrics.charts?.printTypeDistribution?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-around text-xs border-t border-slate-800 pt-3">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className="text-slate-300">Black & White</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-slate-300">Color</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
        <h3 className="font-bold text-sm text-white">Recent Customer Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
              <tr>
                <th className="pb-3">Order Number</th>
                <th className="pb-3">Customer</th>
                <th className="pb-3">Pages / Copies</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Payment</th>
                <th className="pb-3">Print Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {metrics.recentOrders?.map((order: any) => (
                <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 font-mono font-semibold text-blue-400">{order.orderNumber}</td>
                  <td className="py-3.5 text-slate-200">{order.customerName || 'Walk-in'}</td>
                  <td className="py-3.5 text-slate-400">{order.totalPages} pgs • {order.totalCopies}x</td>
                  <td className="py-3.5 font-mono text-slate-200 font-bold">₹{order.totalAmount.toFixed(2)}</td>
                  <td className="py-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {order.printStatus}
                    </span>
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

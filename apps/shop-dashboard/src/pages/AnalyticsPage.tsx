import React from 'react';
import { BarChart3, TrendingUp, DollarSign, FileText, Users, ArrowUpRight } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            <span>Store Analytics & Revenue Reports</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time insights into print volume, daily revenue trends, popular paper formats, and customer checkout methods
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Weekly Revenue', value: '₹14,850', change: '+18.4%', icon: DollarSign, color: 'text-emerald-400' },
          { label: 'Total Pages Spooled', value: '6,420', change: '+12.1%', icon: FileText, color: 'text-purple-400' },
          { label: 'Orders Completed', value: '384', change: '+9.5%', icon: TrendingUp, color: 'text-blue-400' },
          { label: 'Repeat Customers', value: '68%', change: '+5.2%', icon: Users, color: 'text-amber-400' },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">{kpi.label}</span>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div className="text-2xl font-black text-white">{kpi.value}</div>
              <div className="text-[11px] font-bold text-emerald-400 flex items-center space-x-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{kpi.change} vs last week</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart Mock / Visual breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-white">Daily Print Volume & Revenue (Last 7 Days)</h3>
          <div className="h-48 flex items-end justify-between gap-2 pt-6 px-2">
            {[
              { day: 'Mon', pages: 840, height: '60%' },
              { day: 'Tue', pages: 960, height: '70%' },
              { day: 'Wed', pages: 1200, height: '85%' },
              { day: 'Thu', pages: 780, height: '55%' },
              { day: 'Fri', pages: 1450, height: '100%' },
              { day: 'Sat', pages: 1100, height: '78%' },
              { day: 'Sun', pages: 520, height: '40%' },
            ].map((d, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-slate-800 rounded-t-xl relative overflow-hidden group flex items-end justify-center" style={{ height: '140px' }}>
                  <div
                    className="w-full bg-gradient-to-t from-purple-600 to-pink-500 rounded-t-xl transition-all group-hover:brightness-125"
                    style={{ height: d.height }}
                  ></div>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-white">Format Distribution</h3>
          <div className="space-y-3 pt-2 text-xs">
            {[
              { name: 'A4 Black & White Single', pct: 62, color: 'bg-purple-500' },
              { name: 'A4 Color Laser', pct: 22, color: 'bg-pink-500' },
              { name: 'A4 Duplex (Double-Sided)', pct: 10, color: 'bg-blue-500' },
              { name: 'A3 Posters / Large Format', pct: 6, color: 'bg-amber-500' },
            ].map((f, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>{f.name}</span>
                  <span className="font-bold text-white">{f.pct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${f.color} rounded-full`} style={{ width: `${f.pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

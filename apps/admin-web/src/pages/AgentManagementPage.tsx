import React, { useEffect, useState } from 'react';
import { api, API_BASE_URL } from '../lib/api';
import {
  Laptop,
  Download,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Clock,
  RefreshCw,
  Zap,
  Layers,
} from 'lucide-react';
import { AgentVersionDTO } from '@printqr/types';

export const AgentManagementPage: React.FC = () => {
  const [releases, setReleases] = useState<AgentVersionDTO[]>([]);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resReleases, resTelemetry] = await Promise.all([
        api.get('/admin/agents/releases'),
        api.get('/admin/agents/monitoring'),
      ]);

      if (resReleases.data.success) setReleases(resReleases.data.data);
      if (resTelemetry.data.success) setTelemetry(resTelemetry.data.data);
    } catch (err) {
      console.error('Failed to load agent data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Loading Agent Console...</div>;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Laptop className="w-5 h-5 text-indigo-400" />
            <span>Windows Print Agent Releases & Fleet Telemetry</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage desktop binary releases and monitor live shop agent connections
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Fleet Telemetry</span>
        </button>
      </div>

      {/* Fleet Telemetry Cards */}
      {telemetry && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Connected Agents</span>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            </div>
            <div className="text-2xl font-black text-white font-mono">{telemetry.connectedCount}</div>
            <div className="text-[10px] text-emerald-400 font-semibold">Active Windows Daemons</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Offline Agents</span>
              <div className="w-2 h-2 rounded-full bg-slate-600"></div>
            </div>
            <div className="text-2xl font-black text-white font-mono">{telemetry.offlineCount}</div>
            <div className="text-[10px] text-slate-500 font-semibold">Disconnected / Standby</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Active Hardware Printers</span>
              <Printer className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{telemetry.onlinePrintersCount}</div>
            <div className="text-[10px] text-indigo-400 font-semibold">Ready for spooling</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Spooler Pending Jobs</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{telemetry.pendingJobs}</div>
            <div className="text-[10px] text-amber-400 font-semibold">In spooling transit</div>
          </div>
        </div>
      )}

      {/* Agent Releases Table */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
        <h3 className="font-bold text-sm text-white flex items-center space-x-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Desktop Agent Binary Releases</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
              <tr>
                <th className="pb-3">Version</th>
                <th className="pb-3">Platform</th>
                <th className="pb-3">Release Notes</th>
                <th className="pb-3">File Size</th>
                <th className="pb-3">Downloads</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {releases.map((rel) => (
                <tr key={rel.id} className="hover:bg-slate-800/40">
                  <td className="py-3 font-mono font-bold text-indigo-400">v{rel.version}</td>
                  <td className="py-3 text-slate-300 font-semibold">{rel.platform}</td>
                  <td className="py-3 text-slate-400 max-w-xs truncate">{rel.releaseNotes}</td>
                  <td className="py-3 text-slate-300 font-mono">{(rel.fileSize / (1024 * 1024)).toFixed(1)} MB</td>
                  <td className="py-3 text-slate-300 font-mono">{rel.downloadCount}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rel.isLatest ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                      {rel.isLatest ? 'Latest Production' : 'Active'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <a
                      href={`${API_BASE_URL}/admin/agents/download/latest`}
                      className="px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-[11px] font-semibold inline-flex items-center space-x-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Connected Agent Fleet Table */}
      {telemetry?.agents && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
          <h3 className="font-bold text-sm text-white">Live Connected Windows Agents</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="pb-3">Shop Center</th>
                  <th className="pb-3">Device Name</th>
                  <th className="pb-3">Agent Version</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Last Heartbeat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {telemetry.agents.map((agent: any) => (
                  <tr key={agent.id} className="hover:bg-slate-800/40">
                    <td className="py-3 font-semibold text-white">{agent.shop?.name || 'Unassigned'}</td>
                    <td className="py-3 text-slate-300 font-mono">{agent.deviceName}</td>
                    <td className="py-3 text-indigo-400 font-mono">v{agent.agentVersion || '1.0.0'}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${agent.status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                        {agent.status}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">
                      {agent.lastHeartbeat ? new Date(agent.lastHeartbeat).toLocaleTimeString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

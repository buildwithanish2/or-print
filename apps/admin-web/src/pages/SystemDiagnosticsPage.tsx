import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Server, Cpu, Database, Wifi } from 'lucide-react';

export const SystemDiagnosticsPage: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [running, setRunning] = useState(false);

  const runCheck = async () => {
    setRunning(true);
    try {
      const res = await api.get('/admin/diagnostics');
      if (res.data.success) {
        setDiagnostics(res.data.data);
      }
    } catch (err) {
      console.error('Failed to run diagnostics:', err);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    runCheck();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Activity className="w-5 h-5 text-purple-400" />
            <span>Automated Platform Diagnostics & System Health</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time automated inspection of database queries, QR vector engine, pricing calculator, WebSocket spoolers, and Windows agent fleet
          </p>
        </div>

        <button
          type="button"
          disabled={running}
          onClick={runCheck}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-purple-500/25 transition-all transform active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          <span>{running ? 'Inspecting Subsystems...' : 'Run Automated System Check'}</span>
        </button>
      </div>

      {/* Overall Health Card */}
      {diagnostics && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              diagnostics.overallStatus === 'HEALTHY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {diagnostics.overallStatus === 'HEALTHY' ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <div className="font-extrabold text-lg text-white">System Status: {diagnostics.overallStatus}</div>
              <p className="text-xs text-slate-400">Inspected at {new Date(diagnostics.timestamp).toLocaleTimeString()}</p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full bg-slate-800 text-purple-400 text-xs font-mono font-bold border border-slate-700">
            {diagnostics.checks?.length || 10} Subsystems Checked
          </span>
        </div>
      )}

      {/* Checks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {diagnostics?.checks?.map((check: any) => (
          <div
            key={check.system}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg flex items-start justify-between space-x-4"
          >
            <div className="space-y-1">
              <div className="font-bold text-sm text-white flex items-center space-x-2">
                <span>{check.system}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  {check.latencyMs}ms
                </span>
              </div>
              <p className="text-xs text-slate-400">{check.details}</p>
            </div>

            <div className="flex-shrink-0">
              {check.status === 'WORKING' ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  WORKING
                </span>
              ) : check.status === 'WARNING' ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  WARNING
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                  <XCircle className="w-3 h-3 mr-1" />
                  FAILED
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

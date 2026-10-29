import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Printer as PrinterIcon, Plus, CheckCircle, AlertCircle, Wrench, RefreshCw, Key, Monitor, Sparkles } from 'lucide-react';
import { PrinterDTO } from '@printqr/types';

export const PrintersPage: React.FC = () => {
  const [printers, setPrinters] = useState<PrinterDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairingCodeData, setPairingCodeData] = useState<{ pairingCode: string; agentToken: string } | null>(null);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  const fetchPrinters = async () => {
    try {
      const res = await api.get('/printers');
      if (res.data.success) {
        setPrinters(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load printers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrinters();
  }, []);

  const handleGeneratePairingCode = async () => {
    setGeneratingCode(true);
    try {
      const res = await api.post('/shops/agent/pairing-code');
      if (res.data.success) {
        setPairingCodeData(res.data.data);
        setShowPairingModal(true);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleSetDefault = async (printerId: string) => {
    try {
      await api.patch(`/printers/${printerId}`, { isDefault: true });
      fetchPrinters();
    } catch (err: any) {
      alert(err.message || 'Failed to update printer');
    }
  };

  const handleTestPrint = async (printerId: string) => {
    try {
      const res = await api.post(`/printers/${printerId}/test-print`);
      if (res.data.success) {
        alert(`Test Print Dispatched! Job ID: ${res.data.data.testId}`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch test print');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>Shop Printers & Windows Agents</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage local Windows printers linked via the AnishNova Print Agent
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            disabled={generatingCode}
            onClick={handleGeneratePairingCode}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-blue-500/20 transition-all"
          >
            <Key className="w-4 h-4" />
            <span>Pair Windows Desktop Agent</span>
          </button>

          <button
            type="button"
            onClick={fetchPrinters}
            className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
            title="Refresh Printers"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Printers Cards Grid */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading printers...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {printers.map((p) => (
            <div
              key={p.id}
              className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between space-y-5 hover:border-slate-700 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
                    <PrinterIcon className="w-6 h-6" />
                  </div>

                  <div className="flex items-center space-x-2">
                    {p.isDefault && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Default
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
                      Online
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-white">{p.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{p.model}</p>
                </div>

                {/* Hardware Capabilities & Status */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Driver Status</span>
                    <span className="text-emerald-400 font-semibold flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
                      Ready for Spooling
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Two-Sided (Duplex)</span>
                    <span className={`font-semibold ${p.supportsDuplex ? 'text-blue-400' : 'text-slate-400'}`}>
                      {p.supportsDuplex ? 'Hardware Duplex' : 'Simplex Only'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Color Engine</span>
                    <span className={`font-semibold ${p.supportsColor ? 'text-purple-400' : 'text-slate-400'}`}>
                      {p.supportsColor ? 'Full Color (CMYK/RGB)' : 'Monochrome (B&W)'}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Queue Jobs: {p.totalJobsPrinted ?? 0}</span>
                  <span className="text-slate-500 font-mono text-[10px]">Win32 Spooler</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleTestPrint(p.id)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center space-x-1"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Test Print</span>
                </button>

                {!p.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(p.id)}
                    className="px-3 py-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 font-semibold text-xs transition-colors"
                  >
                    Set Default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Windows Agent Pairing Modal */}
      {showPairingModal && pairingCodeData && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/20">
                <Monitor className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white">Pair Windows Desktop Agent</h3>
              <p className="text-xs text-slate-400">
                Enter this 6-digit code in the AnishNova Print Agent installed on your shop PC
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Pairing Code</span>
              <div className="text-4xl font-black text-blue-400 font-mono tracking-widest">
                {pairingCodeData.pairingCode}
              </div>
              <p className="text-[11px] text-slate-500">Code expires in 60 minutes</p>
            </div>

            <div className="space-y-2 text-xs text-slate-400 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
              <div className="font-semibold text-slate-200">How to Connect:</div>
              <p>1. Open **AnishNova Print Agent** on your Windows PC.</p>
              <p>2. Enter code <strong className="text-white font-mono">{pairingCodeData.pairingCode}</strong> and click **Activate Agent**.</p>
              <p>3. Your local printer will automatically sync and receive print jobs.</p>
            </div>

            <button
              type="button"
              onClick={() => setShowPairingModal(false)}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all"
            >
              Done / Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

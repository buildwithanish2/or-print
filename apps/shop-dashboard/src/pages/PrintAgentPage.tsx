import React, { useState, useEffect } from 'react';
import { api, API_BASE_URL } from '../lib/api';
import {
  Laptop,
  Download,
  Key,
  CheckCircle2,
  Clock,
  Printer,
  Copy,
  Check,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  Zap,
  AlertTriangle,
  Play,
} from 'lucide-react';

export const PrintAgentPage: React.FC = () => {
  const [pairingData, setPairingData] = useState<any>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 mins (600s)
  const [agentStatus, setAgentStatus] = useState<any>(null);

  // Generate pairing code
  const handleGeneratePairingCode = async () => {
    setLoadingCode(true);
    try {
      const res = await api.post('/shops/agent/pairing-code');
      if (res.data.success) {
        setPairingData(res.data.data);
        setTimeLeft(600);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate pairing code');
    } finally {
      setLoadingCode(false);
    }
  };

  useEffect(() => {
    handleGeneratePairingCode();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const handleCopyCode = () => {
    if (pairingData?.pairingCode) {
      navigator.clipboard.writeText(pairingData.pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const installSteps = [
    { num: 'Step 1', title: 'Download Agent', desc: 'Download the official Windows installer (.exe) to your shop counter PC.' },
    { num: 'Step 2', title: 'Install Application', desc: 'Run the installer. It will install background spooler services automatically.' },
    { num: 'Step 3', title: 'Pair Shop Code', desc: 'Open AnishNova Print Agent and enter the 10-minute temporary PIN below.' },
    { num: 'Step 4', title: 'Select Printer', desc: 'Choose your default connected USB or Network Windows printer from the list.' },
    { num: 'Step 5', title: 'Test Print', desc: 'Click "Test Print" in the agent to verify physical printhead communication.' },
    { num: 'Step 6', title: 'Automatic Mode', desc: 'Leave agent running in background. Paid customer print orders will print instantly!' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-purple-900/40 via-slate-900 to-slate-900 border border-purple-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-[11px] font-bold border border-purple-500/30">
            <Zap className="w-3.5 h-3.5" />
            <span>Windows Print Spooler Integration</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white">AnishNova Windows Print Agent</h2>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Connect your physical Windows computer to automatically spool and print incoming customer orders in real-time.
          </p>
        </div>

        <div className="flex-shrink-0">
          <a
            href={`${API_BASE_URL}/admin/agents/download/latest`}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white font-black text-xs shadow-xl shadow-purple-500/25 flex items-center space-x-2 transition-all transform active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download Windows Agent (v1.0.0)</span>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pairing Code Card */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm text-white flex items-center space-x-2">
                <Key className="w-4 h-4 text-purple-400" />
                <span>Shop Pairing Code</span>
              </div>
              <button
                type="button"
                onClick={handleGeneratePairingCode}
                disabled={loadingCode}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                title="Generate New Code"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCode ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Enter this temporary secure PIN in your installed AnishNova Print Agent to link your physical counter PC:
            </p>

            {/* Code Box */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/40 text-center space-y-2">
              <div className="font-mono text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 tracking-wider">
                {pairingData?.pairingCode || 'ANP-XXXX-XXXX'}
              </div>

              <div className="flex items-center justify-center space-x-1.5 text-[11px] text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Code expires in {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Code Copied!' : 'Copy Pairing Code'}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/50 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-200 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero Password Exposure</span>
            </div>
            <p>Your shop master passwords are never stored inside the desktop agent.</p>
          </div>
        </div>

        {/* 6-Step Installation Guide */}
        <div className="lg:col-span-2 p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
          <div>
            <h3 className="font-extrabold text-base text-white">Setup & Installation Guide</h3>
            <p className="text-xs text-slate-400 mt-0.5">Follow these 6 simple steps to start automatic physical printing</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {installSteps.map((s) => (
              <div key={s.num} className="p-4 rounded-2xl bg-slate-800/50 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 font-mono">
                  {s.num}
                </span>
                <div className="font-bold text-xs text-white">{s.title}</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
            <div>
              Compatible with <strong className="text-white">Windows 10 / 11 (64-bit)</strong> and all standard printer drivers.
            </div>
            <a
              href={`${API_BASE_URL}/admin/agents/download/latest`}
              className="text-purple-400 hover:text-purple-300 font-bold flex items-center space-x-1"
            >
              <span>Download Agent Installer</span>
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

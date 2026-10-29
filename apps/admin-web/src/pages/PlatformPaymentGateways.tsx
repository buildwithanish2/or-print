import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  CreditCard,
  Check,
  ShieldCheck,
  Key,
  RefreshCw,
  Zap,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const PlatformPaymentGateways: React.FC = () => {
  const [gateways, setGateways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'RAZORPAY' | 'CASHFREE' | 'STRIPE' | 'UPI'>('RAZORPAY');

  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [upiVpa, setUpiVpa] = useState('');
  const [isTestMode, setIsTestMode] = useState(true);
  const [isEnabled, setIsEnabled] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchGateways = async () => {
    try {
      const res = await api.get('/payments/platform/gateways');
      if (res.data.success && Array.isArray(res.data.data)) {
        setGateways(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load platform gateways:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGateways();
  }, []);

  // Synchronize form fields whenever selectedProvider or gateways changes
  useEffect(() => {
    const current = gateways.find((g) => g.provider === selectedProvider);
    if (current) {
      setApiKey(current.apiKey || '');
      setApiSecret(current.secretConfigured ? '••••••••••••••••••••' : '');
      setWebhookSecret(current.webhookSecret || '');
      setUpiVpa(current.upiVpa || '');
      setIsTestMode(typeof current.isTestMode === 'boolean' ? current.isTestMode : true);
      setIsEnabled(typeof current.isEnabled === 'boolean' ? current.isEnabled : true);
    } else {
      setApiKey('');
      setApiSecret('');
      setWebhookSecret('');
      setUpiVpa('');
      setIsTestMode(true);
      setIsEnabled(false);
    }
  }, [selectedProvider, gateways]);

  const handleSaveGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProvider(selectedProvider);
    setSuccessMsg(null);
    try {
      const payload = {
        provider: selectedProvider,
        apiKey: apiKey || undefined,
        apiSecret: apiSecret || undefined,
        webhookSecret: webhookSecret || undefined,
        upiVpa: upiVpa || undefined,
        isTestMode,
        isEnabled,
      };

      const res = await api.post('/payments/platform/gateways', payload);
      if (res.data.success) {
        setSuccessMsg(`✓ Platform ${selectedProvider} settings updated successfully!`);
        await fetchGateways();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save gateway');
    } finally {
      setSavingProvider(null);
    }
  };

  const currentConfig = gateways.find((g) => g.provider === selectedProvider);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-purple-400" />
            <span>Platform Payment Gateways (SaaS Subscriptions)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure platform-level payment providers (Razorpay, Cashfree, Stripe, UPI) for shop registration and subscription plans
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['RAZORPAY', 'CASHFREE', 'STRIPE', 'UPI'] as const).map((p) => {
          const config = gateways.find((g) => g.provider === p);
          const isConfigured = Boolean(config && (config.apiKey || config.upiVpa || config.secretConfigured));
          const isLive = Boolean(config && config.isEnabled && isConfigured);

          let statusLabel = 'Not Configured';
          let dotColor = 'bg-slate-600';
          let textColor = 'text-slate-500';

          if (isLive) {
            statusLabel = 'Configured';
            dotColor = 'bg-emerald-400';
            textColor = 'text-emerald-400';
          } else if (isConfigured) {
            statusLabel = 'Configured (Disabled)';
            dotColor = 'bg-amber-400';
            textColor = 'text-amber-400';
          }

          return (
            <button
              key={p}
              type="button"
              onClick={() => setSelectedProvider(p)}
              className={`p-4 rounded-2xl border text-left space-y-1 transition-all ${
                selectedProvider === p
                  ? 'bg-purple-600/20 border-purple-500 text-white shadow-md'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-black text-xs">{p}</div>
              <div className="flex items-center space-x-1.5 text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                <span className={textColor}>{statusLabel}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Form */}
      <form
        onSubmit={handleSaveGateway}
        className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5 text-xs"
      >
        <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-white">Configure {selectedProvider} Platform Gateway</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Used for collecting merchant plan fees and add-ons</p>
          </div>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
            />
            <span className="font-bold text-white">Enable Gateway</span>
          </label>
        </div>

        {selectedProvider === 'UPI' ? (
          <div>
            <label className="block text-slate-300 font-bold mb-1">Platform UPI VPA Address *</label>
            <input
              type="text"
              required
              value={upiVpa}
              onChange={(e) => setUpiVpa(e.target.value)}
              placeholder="e.g. anishnovaprint@upi"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-bold mb-1">API Key ID / Client ID</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="rzp_live_... / pk_live_..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Secret Key</label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="••••••••••••••••••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Webhook Secret</label>
              <input
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="whsec_..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="font-bold text-white">Sandbox Mode</div>
            <div className="text-[11px] text-slate-400">Use test environments for transaction simulations</div>
          </div>

          <input
            type="checkbox"
            checked={isTestMode}
            onChange={(e) => setIsTestMode(e.target.checked)}
            className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
          />
        </div>

        <div className="pt-2 flex justify-between items-center">
          <div className="text-[11px] text-slate-500">
            {currentConfig?.updatedAt && (
              <span>Last saved: {new Date(currentConfig.updatedAt).toLocaleString()}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={savingProvider === selectedProvider}
            className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md shadow-purple-500/20 flex items-center space-x-1.5 transition-all disabled:opacity-50"
          >
            {savingProvider === selectedProvider ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Key className="w-4 h-4" />
            )}
            <span>{savingProvider === selectedProvider ? 'Saving...' : `Save ${selectedProvider} Gateway`}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

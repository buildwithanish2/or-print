import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  CreditCard,
  Zap,
  Key,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const ShopPaymentSettingsPage: React.FC = () => {
  const [gateways, setGateways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ status: string; message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Active form state per provider
  const [selectedProvider, setSelectedProvider] = useState<'UPI' | 'RAZORPAY' | 'PAY_AT_COUNTER'>('UPI');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [upiVpa, setUpiVpa] = useState('');
  const [isTestMode, setIsTestMode] = useState(true);
  const [isEnabled, setIsEnabled] = useState(true);

  // Test UPI Modal

  // Fetch gateways from backend database
  const fetchGateways = async () => {
    try {
      const res = await api.get('/payments/shop/gateways');
      if (res.data.success && Array.isArray(res.data.data)) {
        setGateways(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load gateways:', err);
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
      setWebhookSecret(current.webhookSecretConfigured ? '••••••••••••••••••••' : '');
      setMerchantId(current.merchantId || '');
      setUpiVpa(current.upiVpa || '');
      setIsTestMode(typeof current.isTestMode === 'boolean' ? current.isTestMode : false);
      setIsEnabled(typeof current.isEnabled === 'boolean' ? current.isEnabled : true);
    } else {
      setApiKey('');
      setApiSecret('');
      setWebhookSecret('');
      setMerchantId('');
      setUpiVpa('');
      setIsTestMode(true);
      setIsEnabled(selectedProvider === 'UPI' || selectedProvider === 'PAY_AT_COUNTER');
    }
  }, [selectedProvider, gateways]);

  const handleSaveGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProvider(selectedProvider);
    setSuccessToast(null);

    try {
      const payload = {
        provider: selectedProvider,
        apiKey: apiKey || undefined,
        apiSecret: apiSecret || undefined,
        webhookSecret: webhookSecret || undefined,
        merchantId: merchantId || undefined,
        upiVpa: upiVpa || undefined,
        isTestMode,
        isEnabled,
      };

      const res = await api.post('/payments/shop/gateways', payload);
      if (res.data.success) {
        setSuccessToast(`✓ ${selectedProvider === 'UPI' ? 'Direct UPI' : selectedProvider} settings saved successfully!`);
        await fetchGateways();
        setTimeout(() => setSuccessToast(null), 4000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save gateway');
    } finally {
      setSavingProvider(null);
    }
  };

  const handleTestConnection = async () => {
    if (selectedProvider === 'PAY_AT_COUNTER') {
      setTestResult({ status: 'CONFIGURED', message: 'Cash acceptance is controlled by the saved toggle; no gateway connection is needed.' });
      return;
    }
    setTestingConnection(true);
    setTestResult(null);
    try {
      if (selectedProvider === 'UPI') {
        const res = await api.post('/payments/shop/gateways/test-upi', {
          upiVpa,
          displayName: merchantId || 'Print Shop',
        });
        if (res.data.success) {
          setTestResult({
            status: 'FORMAT_VALIDATED',
            message: 'UPI ID format looks valid. This does not verify ownership or confirm that a payment was received.',
          });
        }
      } else {
        const res = await api.post('/payments/shop/gateways/test', { provider: selectedProvider });
        if (res.data.success) {
          const result = res.data.results?.find((r: any) => r.provider === selectedProvider) || {
            status: 'CONFIGURED',
            message: 'Settings are saved. No live payment was performed by this configuration check.',
          };
          setTestResult(result);
        }
      }
    } catch (err: any) {
      setTestResult({ status: 'FAILED', message: err.response?.data?.message || err.message || 'Handshake failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  const currentGatewayConfig = gateways.find((g) => g.provider === selectedProvider);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-purple-400" />
            <span>Direct UPI &amp; Merchant Payment Settings</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure direct shop UPI, cash at counter, or your shop’s Razorpay account. UPI payments are manually verified by shop staff.
          </p>
        </div>

        <button
          type="button"
          disabled={testingConnection}
          onClick={handleTestConnection}
          className="px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-semibold border border-purple-500/30 flex items-center space-x-1.5 transition-colors disabled:opacity-50"
        >
          {testingConnection ? (
            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
          ) : (
            <Zap className="w-4 h-4 text-purple-400" />
          )}
          <span>{testingConnection ? 'Checking...' : selectedProvider === 'UPI' ? 'Check UPI format' : selectedProvider === 'PAY_AT_COUNTER' ? 'Cash settings' : 'Check configuration'}</span>
        </button>
      </div>

      {successToast && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {testResult && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center space-x-2 ${
            testResult.status === 'VERIFIED'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}
        >
          {testResult.status === 'VERIFIED' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Gateway Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(['UPI', 'PAY_AT_COUNTER', 'RAZORPAY'] as const).map((p) => {
          const config = gateways.find((g) => g.provider === p);
          const isConfigured = Boolean(config && (p === 'PAY_AT_COUNTER' || config.apiKey || config.upiVpa || config.secretConfigured));
          const isLive = Boolean(config && config.isEnabled && isConfigured);

          let statusLabel = 'Not Configured';
          let dotColor = 'bg-slate-600';
          let textColor = 'text-slate-500';

          if (isLive) {
            statusLabel = 'Active & Direct';
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
              <div className="flex items-center justify-between">
                <span className="font-black text-xs">{p === 'UPI' ? 'Direct UPI' : p === 'PAY_AT_COUNTER' ? 'Cash at Shop' : p}</span>
                {p === 'UPI' && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300">0% Fees</span>
                )}
              </div>
              <div className="flex items-center space-x-1.5 text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                <span className={textColor}>{statusLabel}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Direct UPI Highlights Banner */}
      {selectedProvider === 'UPI' && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/20 flex items-start space-x-3 text-xs">
          <Sparkles className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-white">Direct UPI — No Razorpay / Gateway API Keys Required</div>
            <div className="text-slate-300 text-[11px] leading-relaxed">
              Simply enter your store’s Google Pay, PhonePe, Paytm, or BHIM UPI ID. When customers upload documents, they can scan your dynamic UPI QR or open their UPI app to pay directly into your personal or business bank account.
            </div>
          </div>
        </div>
      )}

      {/* Credentials Form Card */}
      <form
        onSubmit={handleSaveGateway}
        className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5 text-xs"
      >
        <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-white">
              {selectedProvider === 'UPI' ? 'Configure Direct Store UPI VPA' : selectedProvider === 'PAY_AT_COUNTER' ? 'Configure Cash Acceptance' : `Configure ${selectedProvider} Merchant Settings`}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {selectedProvider === 'UPI'
                ? 'UPI payments are sent directly to the configured shop UPI ID and require manual verification.'
                : selectedProvider === 'PAY_AT_COUNTER'
                  ? 'Choose whether customers may place orders and pay cash at your counter.'
                  : `Enter your API credentials from your ${selectedProvider} dashboard`}
            </p>
          </div>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
            />
            <span className="font-bold text-white">Enable Provider</span>
          </label>
        </div>

        {selectedProvider === 'PAY_AT_COUNTER' ? (
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 text-xs leading-relaxed text-slate-300">
            Cash orders remain unpaid until an authorized shop operator records collection. Disabling cash here hides this payment method from customers.
          </div>
        ) : selectedProvider === 'UPI' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Store UPI VPA Address *</label>
              <input
                type="text"
                required
                value={upiVpa}
                onChange={(e) => setUpiVpa(e.target.value)}
                placeholder="e.g. abcprint@upi, 9876543210@ybl, shopname@oksbi"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Supported handles: @okhdfcbank, @oksbi, @okaxis, @okicici, @paytm, @ybl, @ibl, @axl, @upi, etc.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-bold mb-1">UPI Payee Display Name</label>
                <input
                  type="text"
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  placeholder="e.g. ABC Digital Print Hub"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Payment Note / Instructions for Customer</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="e.g. Scan with GPay / PhonePe / Paytm"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-bold mb-1">API Key ID / Client ID</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="rzp_live_... / sk_..."
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
              {selectedProvider === 'RAZORPAY' && <div className="md:col-span-2">
                <label className="block text-slate-300 font-bold mb-1">Razorpay Webhook Secret</label>
                <input type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="Optional; encrypts webhook verification for this shop" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500" />
                <p className="mt-1 text-[10px] text-slate-500">Configure the same secret on the shop’s Razorpay webhook endpoint. Checkout success is still confirmed server-side against Razorpay.</p>
              </div>}
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-bold text-white">Sandbox / Test Mode</div>
                <div className="text-[11px] text-slate-400">Simulate test payments without real bank deductions</div>
              </div>

              <input
                type="checkbox"
                checked={isTestMode}
                onChange={(e) => setIsTestMode(e.target.checked)}
                className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
              />
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-between items-center">
          <div className="text-[11px] text-slate-500">
            {currentGatewayConfig?.updatedAt && (
              <span>Last saved: {new Date(currentGatewayConfig.updatedAt).toLocaleString()}</span>
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
            <span>{savingProvider === selectedProvider ? 'Saving...' : `Save ${selectedProvider === 'UPI' ? 'Direct UPI' : selectedProvider} Settings`}</span>
          </button>
        </div>
      </form>

    </div>
  );
};

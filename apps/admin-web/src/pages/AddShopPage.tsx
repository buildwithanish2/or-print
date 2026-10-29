import React, { useState } from 'react';
import { api, SHOP_PORTAL_URL } from '../lib/api';
import {
  Store,
  CheckCircle2,
  Download,
  ExternalLink,
  Key,
  Copy,
  Check,
  ArrowRight,
  Shield,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface AddShopPageProps {
  onShopCreated?: () => void;
}

export const AddShopPage: React.FC<AddShopPageProps> = ({ onShopCreated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdData, setCreatedData] = useState<any>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('MG Road, Commercial Complex');
  const [city, setCity] = useState('Bengaluru');
  const [state, setState] = useState('Karnataka');
  const [pin, setPin] = useState('560001');
  const [gst, setGst] = useState('');
  const [planName, setPlanName] = useState('Pro');
  const [status, setStatus] = useState('ACTIVE');

  const [copiedCode, setCopiedCode] = useState(false);

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        name,
        ownerName,
        email,
        phone,
        password,
        address,
        city,
        state,
        pin,
        gst: gst || undefined,
        planName,
        status,
      };

      const res = await api.post('/admin/shops/create', payload);
      if (res.data.success) {
        setCreatedData(res.data.data);
        if (onShopCreated) onShopCreated();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create shop');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (createdData?.pairingCode) {
      navigator.clipboard.writeText(createdData.pairingCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleDownloadQR = () => {
    if (!createdData?.qrDataUrl) return;
    const link = document.createElement('a');
    link.href = createdData.qrDataUrl;
    link.download = `AnishNovaPrint_QR_${createdData.shop.slug}.png`;
    link.click();
  };

  const handleImpersonate = async () => {
    if (!createdData?.shop?.id) return;
    try {
      const res = await api.post(`/admin/shops/${createdData.shop.id}/impersonate`);
      if (res.data.success) {
        localStorage.setItem('printqr_shop_token', res.data.data.accessToken);
        localStorage.setItem('printqr_shop_user', JSON.stringify(res.data.data.user));
        localStorage.setItem('printqr_shop_data', JSON.stringify(res.data.data.shop));
        window.open(SHOP_PORTAL_URL, '_blank');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to login as shop owner');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Store className="w-5 h-5 text-indigo-400" />
            <span>Add New Merchant Store</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manually provision a print shop, owner login, dynamic QR code, and desktop pairing token
          </p>
        </div>
      </div>

      {createdData ? (
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-xl">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl font-black text-white">Shop Created Successfully!</h3>
            <p className="text-xs text-slate-400">
              Store <strong className="text-white">{createdData.shop.name}</strong> is now live on AnishNova Print.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left text-xs">
            {/* QR Card */}
            <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3 text-center">
              <div className="font-bold text-slate-200">Store Direct QR Code</div>
              <div className="bg-white p-3 rounded-2xl inline-block shadow-lg mx-auto">
                <img
                  src={createdData.qrDataUrl}
                  alt="Shop QR"
                  className="w-36 h-36 mx-auto rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={handleDownloadQR}
                className="w-full py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold flex items-center justify-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download QR PNG</span>
              </button>
            </div>

            {/* Credentials & Actions Card */}
            <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="font-bold text-slate-200">Owner & Pairing Details</div>
                <div className="space-y-1 text-slate-300 text-[11px]">
                  <div>Owner: <strong className="text-white">{createdData.owner.name}</strong></div>
                  <div>Email: <strong className="text-white">{createdData.owner.email}</strong></div>
                  <div>Direct URL: <span className="text-indigo-400 font-mono">{createdData.shopUrl}</span></div>
                </div>

                <div className="pt-2">
                  <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Desktop Pairing PIN:</div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-indigo-500/40 flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-indigo-300">{createdData.pairingCode}</span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleImpersonate}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center space-x-1.5 shadow-md transition-colors"
                >
                  <span>Login as Shop Owner</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setCreatedData(null)}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Create Another Shop
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreateShop} className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5 text-xs">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Shop Name *</label>
              <input
                type="password"
                required
                minLength={12}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Apex Digital Print"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Owner Name *</label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Sandeep Kumar"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@apexdigital.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Initial Password *</label>
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">SaaS Plan Tier</label>
              <select
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none"
              >
                <option value="Demo">Demo (₹0/mo)</option>
                <option value="Starter">Starter (₹649/mo)</option>
                <option value="Pro">Pro (₹799/mo)</option>
                <option value="Premium">Premium (₹999/mo)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-300 font-bold mb-1">Shop Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 flex items-center space-x-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Create Shop & Generate QR</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

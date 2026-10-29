import React, { useState } from 'react';
import { api } from '../lib/api';
import { Printer, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: any, shop: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        if (!['SHOP_OWNER', 'SHOP_STAFF'].includes(res.data.data.user.role)) {
          throw new Error('This account cannot sign in to the Shop Dashboard.');
        }
        localStorage.setItem('printqr_shop_token', res.data.data.accessToken);
        localStorage.setItem('printqr_shop_user', JSON.stringify(res.data.data.user));
        if (res.data.data.shop) {
          localStorage.setItem('printqr_shop_data', JSON.stringify(res.data.data.shop));
        }
        onLoginSuccess(res.data.data.user, res.data.data.shop);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-xl shadow-blue-500/20">
            <Printer className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">PrintQR Partner Portal</h1>
          <p className="text-xs text-slate-400">Shop Owner & Staff Print Station Management</p>
        </div>

        {/* Login Card */}
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5">
          <p className="text-center text-xs text-slate-400">Shop Owners can create an account through the public shop onboarding flow. Staff accounts are created by an authorized shop owner.</p>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 transition-all"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          <a className="block text-center text-xs text-blue-300 hover:text-blue-200 underline" href="/forgot-password">Forgot password?</a>
        </div>
      </div>
    </div>
  );
};

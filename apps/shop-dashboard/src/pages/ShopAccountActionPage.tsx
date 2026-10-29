import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Mail, Printer, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

type Mode = 'verify' | 'forgot' | 'reset';
type Status = 'ready' | 'loading' | 'success' | 'error';

const getActionToken = () => new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token')
  || new URLSearchParams(window.location.search).get('token') || '';

export const ShopAccountActionPage: React.FC<{ mode: Mode }> = ({ mode }) => {
  const [token] = useState(getActionToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>('ready');
  const [message, setMessage] = useState('');
  const verificationStarted = useRef(false);

  useEffect(() => {
    if (mode !== 'verify' || verificationStarted.current) return;
    verificationStarted.current = true;
    if (!token) {
      setStatus('error');
      setMessage('This verification link is invalid or expired.');
      return;
    }
    setStatus('loading');
    api.post('/auth/verify-email', { token })
      .then((response) => {
        setStatus('success');
        setMessage(response.data.message || 'Email verified. You can now sign in.');
        window.history.replaceState({}, '', window.location.pathname);
      })
      .catch((error: Error) => {
        setStatus('error');
        setMessage(error.message || 'Email verification failed.');
      });
  }, [mode, token]);

  const submitForgot = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      const response = await api.post('/auth/forgot-password', { email });
      setStatus('success');
      setMessage(response.data.message || 'If an eligible account exists, recovery instructions will be sent.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Password recovery is unavailable.');
    }
  };

  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setStatus('error');
      setMessage('This reset link is invalid or expired.');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const response = await api.post('/auth/reset-password', { token, password });
      localStorage.removeItem('printqr_shop_token');
      localStorage.removeItem('printqr_shop_user');
      localStorage.removeItem('printqr_shop_data');
      setStatus('success');
      setMessage(response.data.message || 'Password updated. Please sign in again.');
      window.history.replaceState({}, '', window.location.pathname);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Could not reset the password.');
    }
  };

  const title = mode === 'verify' ? 'Verify your email' : mode === 'forgot' ? 'Reset your password' : 'Choose a new password';
  const description = mode === 'verify'
    ? 'We are securely confirming your shop account email.'
    : mode === 'forgot'
      ? 'Enter your account email. If recovery is available, we will send a one-time link.'
      : 'Choose a new password for your Shop Owner account.';

  return <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
    <div className="w-full max-w-md space-y-6">
      <header className="text-center space-y-3">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/20">
          {mode === 'verify' ? <ShieldCheck className="h-7 w-7" /> : mode === 'forgot' ? <Mail className="h-7 w-7" /> : <Printer className="h-7 w-7" />}
        </div>
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        <p className="text-sm text-slate-400">AnishNova Print Shop Dashboard</p>
      </header>

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-5">
        <p className="text-sm leading-6 text-slate-300">{description}</p>
        {mode === 'verify' ? <div role="status" aria-live="polite" className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-300">
          {status === 'loading' ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Verifying email…</span> : message}
        </div> : mode === 'forgot' ? <form onSubmit={submitForgot} className="space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Email address
            <input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <button disabled={status === 'loading'} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60">
            {status === 'loading' ? 'Sending…' : 'Send password reset link'}
          </button>
          {message && <p role="status" aria-live="polite" className={`text-sm ${status === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{message}</p>}
        </form> : <form onSubmit={submitReset} className="space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">New password (12–128 characters)
            <input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button disabled={status === 'loading' || !token} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
            {status === 'loading' ? 'Updating…' : 'Update password'}
          </button>
          {message && <p role="status" aria-live="polite" className={`text-sm ${status === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{message}</p>}
        </form>}
        <a href="/login" className="flex items-center justify-center gap-2 text-sm font-semibold text-blue-300 underline underline-offset-4 hover:text-blue-200"><ArrowLeft className="h-4 w-4" />Back to sign in</a>
      </section>
    </div>
  </main>;
};

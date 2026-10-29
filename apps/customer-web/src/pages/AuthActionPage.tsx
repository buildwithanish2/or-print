import React, { useEffect, useRef, useState } from 'react';
import { api, SHOP_PORTAL_URL } from '../lib/api';

type Props = { mode: 'verify' | 'reset'; onNavigate: (path: string) => void };

export const AuthActionPage: React.FC<Props> = ({ mode, onNavigate }) => {
  const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token')
    || new URLSearchParams(window.location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'ready' | 'loading' | 'success' | 'error'>('ready');
  const [message, setMessage] = useState('');
  const verificationStarted = useRef(false);

  useEffect(() => {
    if (mode !== 'verify') return;
    if (verificationStarted.current) return;
    verificationStarted.current = true;
    if (!token) { setStatus('error'); setMessage('This verification link is invalid or expired.'); return; }
    setStatus('loading');
    api.post('/auth/verify-email', { token })
      .then((response) => { setStatus('success'); setMessage(response.data.message || 'Email verified. You can sign in.'); })
      .catch((error: Error) => { setStatus('error'); setMessage(error.message); });
  }, [mode, token]);

  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('loading');
    try {
      const response = await api.post('/auth/reset-password', { token, password });
      setStatus('success'); setMessage(response.data.message || 'Password updated. Please sign in.');
    } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'Could not reset password.'); }
  };

  const requestReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setStatus('loading');
    const form = new FormData(event.currentTarget);
    try {
      const response = await api.post('/auth/forgot-password', { email: form.get('email') });
      setStatus('success'); setMessage(response.data.message || 'If an eligible account exists, recovery instructions will be sent.');
    } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'Recovery is unavailable.'); }
  };

  return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-5">
    <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5">
      <div><p className="text-blue-400 text-sm font-semibold">OR PRINT</p><h1 className="text-2xl font-bold">{mode === 'verify' ? 'Email verification' : 'Password recovery'}</h1></div>
      {mode === 'verify' ? <p role="status" className="text-slate-300">{status === 'loading' ? 'Verifying your email…' : message}</p> : token ? <form onSubmit={submitReset} className="space-y-4">
        <label className="block text-sm text-slate-300">New password (12–128 characters)<input className="mt-2 w-full rounded-lg bg-slate-950 border border-slate-700 p-3 text-white" type="password" minLength={12} maxLength={128} autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button disabled={status === 'loading'} className="w-full rounded-lg bg-blue-600 p-3 font-semibold disabled:opacity-50">{status === 'loading' ? 'Updating…' : 'Update password'}</button>
        {message && <p role="status" className="text-sm text-slate-300">{message}</p>}
      </form> : <form onSubmit={requestReset} className="space-y-4">
        <p className="text-sm text-slate-300">Enter your account email. If recovery is available, we’ll send a one-time link.</p>
        <input name="email" className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3 text-white" type="email" maxLength={254} autoComplete="email" required placeholder="Email address" />
        <button disabled={status === 'loading'} className="w-full rounded-lg bg-blue-600 p-3 font-semibold disabled:opacity-50">{status === 'loading' ? 'Sending…' : 'Send recovery link'}</button>
        {message && <p role="status" className="text-sm text-slate-300">{message}</p>}
      </form>}
      {(status === 'success' || status === 'error') && <button type="button" onClick={() => onNavigate('/')} className="text-sm text-blue-300 underline">Back to OR PRINT</button>}
      {mode === 'verify' && status === 'success' && <a href={`${SHOP_PORTAL_URL}/login`} className="block text-center text-sm text-blue-300 underline">Go to shop sign in</a>}
    </section>
  </main>;
};

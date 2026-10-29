import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, FileText, Plus, RefreshCw, Save, X } from 'lucide-react';
import { api } from '../lib/api';
import { getUsageIdentity } from '../lib/usage-display.mjs';

const emptyPolicy = { enabled: false, studentDailyPages: 0, studentMonthlyPages: 0, teacherDailyPages: 0, teacherMonthlyPages: 0, studentDailyCopies: 0, studentMonthlyCopies: 0, teacherDailyCopies: 0, teacherMonthlyCopies: 0, allowBlackWhite: true, allowColor: false, startsAt: '', expiresAt: '' };
const emptyCollegePrices = { singleSidePrice: '', duplexPrice: '', duplexDiscountPercent: '0', bulkMinPages: '50', bulkDiscountPercent: '0' };
const localDateTime = (value: string) => { const date = new Date(value); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };
export const CollegeFreePrintingPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [policy, setPolicy] = useState<any>(emptyPolicy);
  const [institution, setInstitution] = useState({ name: '', domain: '', isActive: true, isEligible: true });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState('');
  const [paperSize, setPaperSize] = useState('A4');
  const [colorMode, setColorMode] = useState('BW');
  const [collegePrices, setCollegePrices] = useState<any>(emptyCollegePrices);
  const [pricingBusy, setPricingBusy] = useState(false);
  const selectedInstitution = data?.institutions?.find((item: any) => item.id === selectedInstitutionId);
  const savedCollegePrice = selectedInstitution?.pricingRules?.find((rule: any) => rule.paperSize === paperSize && rule.colorMode === colorMode);
  const load = async () => {
    setBusy(true); setError('');
    try { const response = await api.get('/free-print/admin'); const result = response.data.data; setData(result); setPolicy(result.policy ? { ...result.policy, startsAt: result.policy.startsAt ? localDateTime(result.policy.startsAt) : '', expiresAt: result.policy.expiresAt ? localDateTime(result.policy.expiresAt) : '' } : emptyPolicy); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load college free-print settings'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!data?.institutions?.length) return;
    if (!data.institutions.some((item: any) => item.id === selectedInstitutionId)) setSelectedInstitutionId(data.institutions[0].id);
  }, [data, selectedInstitutionId]);
  useEffect(() => {
    setCollegePrices(savedCollegePrice ? {
      singleSidePrice: String(savedCollegePrice.singleSidePrice),
      duplexPrice: String(savedCollegePrice.duplexPrice),
      duplexDiscountPercent: String(savedCollegePrice.duplexDiscountPercent),
      bulkMinPages: String(savedCollegePrice.bulkMinPages),
      bulkDiscountPercent: String(savedCollegePrice.bulkDiscountPercent),
    } : emptyCollegePrices);
  }, [selectedInstitutionId, paperSize, colorMode, data]);
  const savePolicy = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(''); setError('');
    try { const payload = { ...policy, startsAt: policy.startsAt ? new Date(policy.startsAt).toISOString() : null, expiresAt: policy.expiresAt ? new Date(policy.expiresAt).toISOString() : null }; await api.put('/free-print/admin/policy', payload); setMessage('Global policy saved. Existing allowance history was preserved.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save policy'); }
    finally { setBusy(false); }
  };
  const saveInstitution = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    try { await api.post('/free-print/admin/institutions', institution); setInstitution({ name: '', domain: '', isActive: true, isEligible: true }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save institution'); }
  };
  const saveCollegePricing = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedInstitutionId) { setError('Select a college before saving its pricing.'); return; }
    setPricingBusy(true); setError(''); setMessage('');
    try {
      const payload = {
        paperSize, colorMode,
        singleSidePrice: Number(collegePrices.singleSidePrice),
        duplexPrice: Number(collegePrices.duplexPrice),
        duplexDiscountPercent: Number(collegePrices.duplexDiscountPercent),
        bulkMinPages: Number(collegePrices.bulkMinPages),
        bulkDiscountPercent: Number(collegePrices.bulkDiscountPercent),
      };
      await api.put(`/free-print/admin/institutions/${encodeURIComponent(selectedInstitutionId)}/pricing`, payload);
      setMessage(`Pricing saved for ${selectedInstitution.name}.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save college pricing'); }
    finally { setPricingBusy(false); }
  };
  const review = async (id: string, action: string) => {
    const reason = action === 'REJECT' ? window.prompt('Reason for rejection (required):') || '' : '';
    if (action === 'REJECT' && reason.trim().length < 4) return;
    try { await api.patch(`/free-print/admin/verifications/${id}`, { action, reason }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update verification'); }
  };
  const openEvidence = async (id: string) => {
    try { const result = await api.get(`/free-print/verification/${id}/evidence`, { responseType: 'blob' }); const url = URL.createObjectURL(result.data); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60000); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open evidence'); }
  };
  const setParticipation = async (shopId: string, participating: boolean) => { try { await api.put(`/free-print/admin/shops/${shopId}`, { participating }); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update shop'); } };
  const updateInstitution = async (item: any, changes: any) => { try { await api.put(`/free-print/admin/institutions/${item.id}`, { name: item.name, domain: item.domain || '', isActive: item.isActive, isEligible: item.isEligible, ...changes }); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update institution'); } };
  const setValue = (key: string, value: unknown) => setPolicy((p: any) => ({ ...p, [key]: value }));
  return <div className="mx-auto max-w-6xl space-y-5 p-4 text-slate-100 sm:p-6">
    <div className="flex items-center justify-between"><div><h1 className="text-xl font-bold">College Free Printing</h1><p className="mt-1 text-sm text-slate-400">Institution eligibility, verification review, limits, and participating shops.</p></div><button onClick={() => void load()} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-3 text-sm"><RefreshCw size={15} />Refresh</button></div>
    {error && <p role="alert" className="flex items-center gap-2 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300"><AlertCircle size={16} />{error}</p>}{message && <p role="status" className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</p>}
    <form onSubmit={savePolicy} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
      <h2 className="font-bold">Global policy · limits use page impressions (selected pages × copies)</h2>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={policy.enabled} onChange={(e) => setValue('enabled', e.target.checked)} />Enable college free printing</label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['studentDailyPages','Student daily pages'],['studentMonthlyPages','Student monthly pages'],['teacherDailyPages','Teacher daily pages'],['teacherMonthlyPages','Teacher monthly pages'],['studentDailyCopies','Student daily copies'],['studentMonthlyCopies','Student monthly copies'],['teacherDailyCopies','Teacher daily copies'],['teacherMonthlyCopies','Teacher monthly copies']].map(([key,label]) => <label key={key} className="text-xs text-slate-400">{label}<input type="number" min={0} max={100000} value={policy[key]} onChange={(e) => setValue(key, Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>)}</div>
      <div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={policy.allowBlackWhite} onChange={(e) => setValue('allowBlackWhite', e.target.checked)} />Black & white allowed</label><label className="flex items-center gap-2"><input type="checkbox" checked={policy.allowColor} onChange={(e) => setValue('allowColor', e.target.checked)} />Color allowed</label></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-400">Starts at<input type="datetime-local" value={policy.startsAt} onChange={(e) => setValue('startsAt', e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label><label className="text-xs text-slate-400">Expires at<input type="datetime-local" value={policy.expiresAt} onChange={(e) => setValue('expiresAt', e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label></div>
      <button disabled={busy} className="flex min-h-10 items-center gap-2 rounded-lg bg-purple-600 px-4 text-sm font-bold disabled:opacity-50"><Save size={15} />Save policy</button>
    </form>
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6"><h2 className="font-bold">Institution directory</h2><form onSubmit={saveInstitution} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]"><input required minLength={2} placeholder="Institution name" value={institution.name} onChange={(e) => setInstitution({ ...institution, name: e.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /><input placeholder="Email domain (optional)" value={institution.domain} onChange={(e) => setInstitution({ ...institution, domain: e.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={institution.isEligible} onChange={(e) => setInstitution({ ...institution, isEligible: e.target.checked })} />Eligible</label><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={institution.isActive} onChange={(e) => setInstitution({ ...institution, isActive: e.target.checked })} />Active</label><button className="flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm"><Plus size={14} />Add</button></form><div className="mt-4 divide-y divide-slate-800">{data?.institutions?.map((item: any) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{item.name} {item.domain && <small className="text-slate-500">· {item.domain}</small>}</span><div className="flex gap-3 text-xs"><label><input type="checkbox" checked={item.isEligible} onChange={(e) => void updateInstitution(item,{isEligible:e.target.checked})} /> Eligible</label><label><input type="checkbox" checked={item.isActive} onChange={(e) => void updateInstitution(item,{isActive:e.target.checked})} /> Active</label></div></div>)}</div></section>
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
      <h2 className="font-bold">College pricing control</h2>
      <p className="mt-1 text-xs text-slate-400">Set paid-order rates for one college, paper size, and print mode. Eligible free-print orders remain ₹0; without an override, existing shop/platform pricing applies.</p>
      {data?.collegePricingAvailable === false ? <p role="alert" className="mt-4 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">College pricing storage is not ready yet. Apply the additive database migration, then refresh this page. Existing pricing continues to apply until then.</p> : !data?.institutions?.length ? <p className="mt-4 text-sm text-slate-400">Add an institution before configuring college pricing.</p> : <form onSubmit={saveCollegePricing} className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-slate-400">College<select value={selectedInstitutionId} onChange={(e) => setSelectedInstitutionId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">{data.institutions.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-xs text-slate-400">Paper size<select value={paperSize} onChange={(e) => setPaperSize(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">{['A4','A3','A5','LETTER','LEGAL','CUSTOM'].map((size) => <option key={size}>{size}</option>)}</select></label>
          <label className="text-xs text-slate-400">Print mode<select value={colorMode} onChange={(e) => setColorMode(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="BW">Black & white</option><option value="COLOR">Color</option></select></label>
        </div>
        <p className="text-xs text-slate-400">{savedCollegePrice ? `Current saved override · updated ${new Date(savedCollegePrice.updatedAt).toLocaleString()}` : 'No college override is saved for this selection. Existing shop/platform pricing is used.'}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {([['singleSidePrice','Single-sided price (₹)'],['duplexPrice','Duplex sheet price (₹)'],['duplexDiscountPercent','Duplex discount (%)'],['bulkMinPages','Bulk threshold (impressions)'],['bulkDiscountPercent','Bulk discount (%)']] as const).map(([key,label]) => <label key={key} className="text-xs text-slate-400">{label}<input required type="number" min={key === 'singleSidePrice' || key === 'duplexPrice' ? 0.1 : key === 'bulkMinPages' ? 1 : 0} max={key === 'singleSidePrice' || key === 'duplexPrice' ? 100000 : key === 'bulkMinPages' ? 100000 : 100} step={key === 'bulkMinPages' ? 1 : 0.01} value={collegePrices[key]} onChange={(e) => setCollegePrices((current: any) => ({ ...current, [key]: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>)}
        </div>
        <button disabled={pricingBusy || !selectedInstitutionId} className="flex min-h-10 items-center gap-2 rounded-lg bg-purple-600 px-4 text-sm font-bold disabled:opacity-50"><Save size={15} />{pricingBusy ? 'Saving pricing…' : 'Save college pricing'}</button>
      </form>}
    </section>
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6"><h2 className="font-bold">Verification requests and active approvals ({data?.verifications?.length || 0})</h2><div className="mt-3 space-y-3">{data?.verifications?.map((item: any) => <article key={item.id} className="rounded-lg border border-slate-800 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{item.user.name}</strong><p className="text-xs text-slate-400">{item.user.email} · {item.requestedRole} · {item.institution.name}</p><p className="mt-1 text-xs text-slate-500">{item.status} · submitted {new Date(item.submittedAt).toLocaleString()}</p></div><div className="flex flex-wrap gap-2">{item.status === 'PENDING' ? <><button onClick={() => void openEvidence(item.id)} className="flex min-h-9 items-center gap-1 rounded-lg border border-slate-700 px-3 text-xs"><FileText size={14} />Evidence</button><button onClick={() => void review(item.id,'APPROVE')} className="flex min-h-9 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-xs"><Check size={14} />Approve</button><button onClick={() => void review(item.id,'REJECT')} className="flex min-h-9 items-center gap-1 rounded-lg bg-rose-800 px-3 text-xs"><X size={14} />Reject</button></> : <><span className="self-center text-[11px] text-emerald-300">Evidence deleted after review</span><button onClick={() => void review(item.id,'REVOKE')} className="min-h-9 rounded-lg bg-rose-800 px-3 text-xs">Revoke eligibility</button></>}</div></div></article>)}</div></section>
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6"><h2 className="font-bold">Shop participation</h2><div className="mt-3 divide-y divide-slate-800">{data?.shops?.map((shop: any) => <div key={shop.id} className="flex items-center justify-between gap-4 py-3"><span className="text-sm">{shop.name}</span><label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={Boolean(shop.freePrintSettings?.participating)} onChange={(e) => void setParticipation(shop.id,e.target.checked)} />Participating</label></div>)}</div></section>
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6"><h2 className="font-bold">Recent allowance records (Asia/Kolkata boundaries)</h2><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="py-2">Account</th><th>Role</th><th>Period</th><th>Completed impressions</th><th>Reserved</th></tr></thead><tbody>{data?.usage?.map((u: any) => { const identity = getUsageIdentity(u); return <tr key={u.id} className="border-t border-slate-800"><td className="py-2">{identity.name}</td><td>{identity.role}</td><td>{u.periodType} · {u.periodKey}</td><td>{u.completedPages}</td><td>{u.reservedPages}</td></tr>; })}</tbody></table></div></section>
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6"><h2 className="font-bold">Recent policy audit</h2><div className="mt-3 space-y-2">{data?.audits?.map((audit: any) => <div key={audit.id} className="flex flex-wrap justify-between gap-2 border-t border-slate-800 pt-2 text-xs"><span>{audit.scope} · {audit.action} {audit.scopeId ? `· ${audit.scopeId}` : ''}</span><span className="text-slate-500">{new Date(audit.createdAt).toLocaleString()} · {audit.actorUserId}</span></div>)}</div></section>
    {busy && <p role="status" className="text-xs text-slate-500">Loading…</p>}
  </div>;
};

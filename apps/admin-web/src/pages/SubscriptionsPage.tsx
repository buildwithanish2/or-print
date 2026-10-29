import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Layers, Check, Sparkles, Plus, Edit2, X, Tag } from 'lucide-react';
import { SubscriptionPlanDTO } from '@printqr/types';

export const SubscriptionsPage: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlanDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceMonthly, setPriceMonthly] = useState(0);
  const [priceYearly, setPriceYearly] = useState(0);
  const [maxPrinters, setMaxPrinters] = useState(1);
  const [maxOrdersPerMonth, setMaxOrdersPerMonth] = useState(50);
  const [featuresText, setFeaturesText] = useState('1 Windows Printer Connection\nUp to 50 monthly orders\nStandard Counter QR flyer');
  const [isPopular, setIsPopular] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/plans');
      if (res.data.success) {
        setPlans(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setPriceMonthly(499);
    setPriceYearly(4990);
    setMaxPrinters(2);
    setMaxOrdersPerMonth(500);
    setFeaturesText('2 Windows Printer Connections\nUp to 500 monthly orders\nPriority Support');
    setIsPopular(false);
    setShowModal(true);
  };

  const handleOpenEdit = (plan: SubscriptionPlanDTO) => {
    setEditingId(plan.id);
    setName(plan.name);
    setDescription(plan.description);
    setPriceMonthly(plan.priceMonthly);
    setPriceYearly(plan.priceYearly || plan.priceMonthly * 10);
    setMaxPrinters(plan.maxPrinters);
    setMaxOrdersPerMonth(plan.maxOrdersPerMonth);

    let feats: string[] = [];
    try {
      feats = typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || []);
    } catch {}
    setFeaturesText(feats.join('\n'));
    setIsPopular(Boolean(plan.isPopular));
    setShowModal(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const featuresArray = featuresText
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean);

      const payload = {
        id: editingId || undefined,
        name,
        description,
        priceMonthly: Number(priceMonthly),
        priceYearly: Number(priceYearly),
        maxPrinters: Number(maxPrinters),
        maxOrdersPerMonth: Number(maxOrdersPerMonth),
        features: JSON.stringify(featuresArray),
        isPopular,
      };

      const res = await api.post('/admin/plans', payload);
      if (res.data.success) {
        setShowModal(false);
        fetchPlans();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Loading SaaS plans...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Layers className="w-5 h-5 text-purple-400" />
            <span>SaaS Subscription Plans & Merchant Quotas</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure subscription tiers, price models, and hardware allowances (dynamically displayed on public homepage)
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-500/20 flex items-center space-x-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Plan</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => {
          let features: string[] = [];
          try {
            features = typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || []);
          } catch {}

          return (
            <div
              key={plan.id}
              className={`p-6 rounded-3xl bg-slate-900 border flex flex-col justify-between space-y-6 shadow-xl relative overflow-hidden ${
                plan.isPopular ? 'border-purple-500 shadow-purple-500/10' : 'border-slate-800'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-[10px] font-bold uppercase tracking-wider text-white rounded-bl-xl">
                  Popular
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="font-black text-lg text-white">{plan.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">{plan.description}</p>
                </div>

                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl font-black text-white font-mono">₹{plan.priceMonthly}</span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-800 space-y-1 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span>Printers:</span>
                    <span className="font-bold text-white">{plan.maxPrinters} Machine(s)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Monthly Orders:</span>
                    <span className="font-bold text-white">{plan.maxOrdersPerMonth} orders/mo</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 text-xs text-slate-300">
                  <span className="font-bold text-[11px] text-slate-400 uppercase tracking-wider">Features:</span>
                  {features.map((feat, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span className="text-[11px]">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenEdit(plan)}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center justify-center space-x-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Plan Parameters</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSavePlan} className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">{editingId ? 'Edit Plan' : 'Create New Plan'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Plan Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Starter / Pro / Enterprise"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Monthly Price (₹) *</label>
                <input
                  type="number"
                  required
                  value={priceMonthly}
                  onChange={(e) => setPriceMonthly(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-slate-300 font-bold mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short summary for shop owners..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Max Printers Allowed</label>
                <input
                  type="number"
                  required
                  value={maxPrinters}
                  onChange={(e) => setMaxPrinters(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Monthly Orders Quota</label>
                <input
                  type="number"
                  required
                  value={maxOrdersPerMonth}
                  onChange={(e) => setMaxOrdersPerMonth(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-slate-300 font-bold mb-1">Features (One per line) *</label>
                <textarea
                  rows={4}
                  required
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-[11px]"
                ></textarea>
              </div>

              <div className="col-span-2 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="popCheck"
                  checked={isPopular}
                  onChange={(e) => setIsPopular(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600"
                />
                <label htmlFor="popCheck" className="text-slate-300 font-semibold cursor-pointer">
                  Mark as "Most Popular" Plan
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold"
              >
                {saving ? 'Saving...' : 'Save Plan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

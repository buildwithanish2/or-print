import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Tag, Plus, Check, Percent, IndianRupee } from 'lucide-react';
import { CouponDTO } from '@printqr/types';

export const CouponsPage: React.FC = () => {
  const [coupons, setCoupons] = useState<CouponDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState(20);
  const [minOrderAmount, setMinOrderAmount] = useState(10);
  const [maxDiscount, setMaxDiscount] = useState<number | undefined>(50);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/coupons');
      if (res.data.success) {
        setCoupons(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load coupons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        minOrderAmount: Number(minOrderAmount),
        maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
        isActive: true,
      };

      const res = await api.post('/admin/coupons', payload);
      if (res.data.success) {
        setShowCreateModal(false);
        setCode('');
        fetchCoupons();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create coupon');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        <div>
          <h2 className="text-lg font-bold text-white">Promo Discounts & Coupons</h2>
          <p className="text-xs text-slate-400 mt-0.5">Create platform-wide promotional discounts and student offers</p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-indigo-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Coupon</span>
        </button>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading coupons...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="pb-3">Coupon Code</th>
                  <th className="pb-3">Discount Type</th>
                  <th className="pb-3">Value</th>
                  <th className="pb-3">Min Order</th>
                  <th className="pb-3">Max Cap</th>
                  <th className="pb-3">Expiry / Usage</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="py-3.5 font-mono font-bold text-indigo-400">{c.code}</td>
                    <td className="py-3.5 text-slate-300">{c.discountType}</td>
                    <td className="py-3.5 font-semibold text-white">
                      {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `₹${c.discountValue}`}
                    </td>
                    <td className="py-3.5 text-slate-400">₹{c.minOrderAmount}</td>
                    <td className="py-3.5 text-slate-400">{c.maxDiscount ? `₹${c.maxDiscount}` : 'None'}</td>
                    <td className="py-3.5 text-slate-400">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'No expiry'}
                      {c.usageLimit ? ` · ${c.usedCount || 0}/${c.usageLimit} used` : ' · Unlimited'}
                    </td>
                    <td className="py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${!c.isActive || (c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()) || (c.usageLimit && (c.usedCount || 0) >= c.usageLimit) ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                        {!c.isActive ? 'Disabled' : c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now() ? 'Expired' : c.usageLimit && (c.usedCount || 0) >= c.usageLimit ? 'Limit reached' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateCoupon} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="font-bold text-base text-white">Create New Coupon Code</h3>

            <div>
              <label className="block text-slate-400 font-bold mb-1">Coupon Code (Uppercase)</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. SUMMER2026"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Type</label>
                <select
                  value={discountType}
                  onChange={(e: any) => setDiscountType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Flat (₹)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Discount Value</label>
                <input
                  type="number"
                  required
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Min Order Amount (₹)</label>
                <input
                  type="number"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Max Cap Discount (₹)</label>
                <input
                  type="number"
                  value={maxDiscount || ''}
                  onChange={(e) => setMaxDiscount(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
              >
                Create Coupon
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

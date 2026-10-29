import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Users, Plus, Check, X, Shield, Trash2, Key, UserCheck, AlertCircle } from 'lucide-react';

export const StaffManagementPage: React.FC = () => {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('OPERATOR');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'orders.view',
    'orders.manage',
    'printing.view',
    'printing.retry',
  ]);
  const [saving, setSaving] = useState(false);

  const availablePermissions = [
    { id: 'orders.view', label: 'View Orders & Queue' },
    { id: 'orders.manage', label: 'Manage & Cancel Orders' },
    { id: 'printing.view', label: 'View Printer Hardware' },
    { id: 'printing.retry', label: 'Retry & Reposition Print Jobs' },
    { id: 'pricing.view', label: 'View Rates & Pricing' },
    { id: 'pricing.manage', label: 'Modify Pricing & Discounts' },
    { id: 'payments.view', label: 'View Transactions' },
  ];

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get('/shops/staff');
      if (res.data.success) {
        setStaffList(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load staff:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleTogglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        email,
        phone,
        password,
        role,
        permissions: selectedPermissions.join(','),
      };

      const res = await api.post('/shops/staff', payload);
      if (res.data.success) {
        setShowAddModal(false);
        setName('');
        setEmail('');
        setPassword('');
        fetchStaff();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    try {
      await api.delete(`/shops/staff/${staffId}`);
      fetchStaff();
    } catch (err: any) {
      alert(err.message || 'Failed to remove staff');
    }
  };

  const handleToggleActive = async (staffId: string, currentStatus: boolean) => {
    try {
      await api.patch(`/shops/staff/${staffId}`, { isActive: !currentStatus });
      fetchStaff();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-purple-400" />
            <span>Staff & Operator Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Add team members, assign station roles (Manager, Operator, Cashier), and set granular permissions
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-500/20 flex items-center space-x-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Staff Table */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading staff members...</div>
        ) : staffList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No staff members added yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="pb-3">Staff Name</th>
                  <th className="pb-3">Email & Contact</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Permissions</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {staffList.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30">
                    <td className="py-3.5 font-bold text-white">{s.user?.name}</td>
                    <td className="py-3.5 text-slate-300">
                      <div>{s.user?.email}</div>
                      <div className="text-[11px] text-slate-400">{s.user?.phone || 'No phone'}</div>
                    </td>
                    <td className="py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        {s.role}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-400 text-[11px] max-w-xs truncate">
                      {s.permissions}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {s.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s.id, s.isActive)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300"
                      >
                        {s.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStaff(s.id)}
                        className="p-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        title="Remove Staff"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddStaff} className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">Add New Staff Member</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vikas Sharma"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@printshop.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Mobile Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Password *</label>
                <input
                  type="password"
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Staff login password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-slate-300 font-bold mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="OPERATOR">Printer Operator (Spooler & Queue)</option>
                  <option value="MANAGER">Store Manager (Full Shop Access)</option>
                  <option value="CASHIER">Cashier (Pay at Counter & Orders)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-2">Permissions Checklist</label>
              <div className="grid grid-cols-2 gap-2">
                {availablePermissions.map((p) => {
                  const isChecked = selectedPermissions.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      onClick={() => handleTogglePermission(p.id)}
                      className={`p-2.5 rounded-xl border flex items-center space-x-2 cursor-pointer transition-colors ${
                        isChecked ? 'bg-purple-600/20 border-purple-500 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded border-slate-700 text-purple-600"
                      />
                      <span className="text-[11px] font-semibold">{p.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold"
              >
                {saving ? 'Adding...' : 'Add Staff Member'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Menu, Plus, Save, Trash2, Check, ArrowUpDown, ExternalLink, Globe } from 'lucide-react';

export const WebsiteNavigationPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [path, setPath] = useState('');
  const [isExternal, setIsExternal] = useState(false);
  const [openInNewTab, setOpenInNewTab] = useState(false);
  const [displayOrder, setDisplayOrder] = useState('1');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      const res = await api.get('/admin/navigation');
      if (res.data.success) {
        setItems(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load navigation items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        id: editingId || undefined,
        label,
        path,
        isExternal,
        openInNewTab,
        displayOrder: Number(displayOrder),
        isEnabled: true,
      };

      const res = await api.post('/admin/navigation', payload);
      if (res.data.success) {
        fetchItems();
        setLabel('');
        setPath('');
        setIsExternal(false);
        setOpenInNewTab(false);
        setDisplayOrder(String(items.length + 2));
        setEditingId(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save navigation item');
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setLabel(item.label);
    setPath(item.path);
    setIsExternal(item.isExternal);
    setOpenInNewTab(item.openInNewTab);
    setDisplayOrder(String(item.displayOrder));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this navigation item?')) return;
    try {
      const res = await api.delete(`/admin/navigation/${id}`);
      if (res.data.success) {
        fetchItems();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete navigation item');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Menu className="w-5 h-5 text-purple-400" />
            <span>Public Website Navigation Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure header menu items, external links, ordering, and landing page anchor targets
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form */}
        <form onSubmit={handleSave} className="lg:col-span-4 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 text-xs">
          <h3 className="font-bold text-sm text-white flex items-center space-x-1.5">
            <Plus className="w-4 h-4 text-purple-400" />
            <span>{editingId ? 'Edit Navigation Item' : 'Add Navigation Item'}</span>
          </h3>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Menu Label *</label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Partner Program"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Path / URL Target *</label>
            <input
              type="text"
              required
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="e.g. #pricing or /partner"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Display Order</label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div className="flex flex-col justify-end space-y-1">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={openInNewTab}
                  onChange={(e) => setOpenInNewTab(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-purple-600"
                />
                <span className="text-slate-300 text-[11px]">Open New Tab</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isExternal}
                  onChange={(e) => setIsExternal(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-purple-600"
                />
                <span className="text-slate-300 text-[11px]">External URL</span>
              </label>
            </div>
          </div>

          <div className="pt-2 flex items-center space-x-2">
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-purple-500/20"
            >
              <Save className="w-4 h-4" />
              <span>{editingId ? 'Update Item' : 'Create Item'}</span>
            </button>

            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setLabel('');
                  setPath('');
                }}
                className="px-3 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Table */}
        <div className="lg:col-span-8 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                <th className="pb-3 pl-2">Order</th>
                <th className="pb-3">Menu Label</th>
                <th className="pb-3">Target Path</th>
                <th className="pb-3">Type</th>
                <th className="pb-3 text-right pr-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40">
                  <td className="py-3 pl-2 font-mono font-bold text-purple-400">{item.displayOrder}</td>
                  <td className="py-3 font-bold text-white">{item.label}</td>
                  <td className="py-3 font-mono text-slate-300">{item.path}</td>
                  <td className="py-3">
                    {item.isExternal ? (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                        External
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                        Internal
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right pr-2 space-x-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

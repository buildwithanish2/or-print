import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Image, Plus, Save, Trash2, Check, Sparkles } from 'lucide-react';

export const HomepageBannersPage: React.FC = () => {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [ctaText, setCtaText] = useState('Register Your Shop');
  const [ctaUrl, setCtaUrl] = useState('/shop/register');
  const [bgGradient, setBgGradient] = useState('from-purple-900/80 via-pink-900/60 to-slate-900');
  const [displayOrder, setDisplayOrder] = useState('1');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchBanners = async () => {
    try {
      const res = await api.get('/admin/banners');
      if (res.data.success) {
        setBanners(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load banners:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        id: editingId || undefined,
        title,
        subtitle,
        ctaText,
        ctaUrl,
        bgGradient,
        displayOrder: Number(displayOrder),
        isEnabled: true,
      };

      const res = await api.post('/admin/banners', payload);
      if (res.data.success) {
        fetchBanners();
        setTitle('');
        setSubtitle('');
        setEditingId(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save banner');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;
    try {
      const res = await api.delete(`/admin/banners/${id}`);
      if (res.data.success) {
        fetchBanners();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete banner');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Image className="w-5 h-5 text-purple-400" />
            <span>Homepage Marketing Banners & Promo Announcements</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage top marketing ribbons and highlight alerts displayed on the public landing page
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form */}
        <form onSubmit={handleSave} className="lg:col-span-4 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 text-xs">
          <h3 className="font-bold text-sm text-white flex items-center space-x-1.5">
            <Plus className="w-4 h-4 text-purple-400" />
            <span>{editingId ? 'Edit Banner' : 'Create Banner'}</span>
          </h3>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Banner Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Special Launch Offer"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Subtitle / Message</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. First 100 printouts free for new partners"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Button Text</label>
              <input
                type="text"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-bold mb-1">CTA URL</label>
              <input
                type="text"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-purple-500/20"
            >
              <Save className="w-4 h-4" />
              <span>{editingId ? 'Update Banner' : 'Publish Banner'}</span>
            </button>
          </div>
        </form>

        {/* List */}
        <div className="lg:col-span-8 space-y-4">
          {banners.map((b) => (
            <div key={b.id} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400">Order #{b.displayOrder}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(b.id)}
                  className="p-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/60 via-pink-900/40 to-slate-950 border border-purple-500/20 text-white text-xs">
                <div className="font-bold text-sm">{b.title}</div>
                <div className="text-slate-300 text-[11px] mt-1">{b.subtitle}</div>
                <div className="text-purple-400 font-semibold text-[10px] mt-2 underline">{b.ctaText} → {b.ctaUrl}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

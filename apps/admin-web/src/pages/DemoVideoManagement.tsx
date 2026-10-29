import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Video, Play, Save, Check, ExternalLink, Sparkles } from 'lucide-react';

export const DemoVideoManagement: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [provider, setProvider] = useState('YOUTUBE');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchVideo = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/demo-video');
      if (res.data.success && res.data.data) {
        const v = res.data.data;
        setTitle(v.title || '');
        setDescription(v.description || '');
        setVideoUrl(v.videoUrl || '');
        setProvider(v.provider || 'YOUTUBE');
        setIsActive(v.isActive);
      }
    } catch (err) {
      console.error('Failed to load demo video:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideo();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    try {
      const res = await api.post('/admin/demo-video', {
        title,
        description,
        videoUrl,
        provider,
        isActive,
      });

      if (res.data.success) {
        setSuccessMsg('Demo video updated successfully! Public homepage reflects these changes.');
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save demo video');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Video className="w-5 h-5 text-purple-400" />
            <span>Platform Demo Video Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure the interactive video walkthrough displayed on the public landing page hero and workflow section
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <form onSubmit={handleSave} className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 text-xs">
          <h3 className="font-bold text-sm text-white">Video Settings</h3>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Headline Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Watch AnishNova Print in Action"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description highlighting the 3-step automatic spooling process..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
            ></textarea>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Embed Video URL *</label>
            <input
              type="url"
              required
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube-nocookie.com/embed/..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-1">Supports YouTube Embeds, Vimeo, or MP4 Direct URLs</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-bold text-white">Enable Video Section on Public Homepage</div>
              <div className="text-[11px] text-slate-400">Toggle visibility on the marketing landing page</div>
            </div>

            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-700 text-purple-600"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center space-x-1.5 transition-all shadow-md shadow-purple-500/20"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Video Configuration'}</span>
            </button>
          </div>
        </form>

        {/* Live Preview */}
        <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-white">Live Embed Preview</h3>

          <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
            {videoUrl ? (
              <iframe
                src={videoUrl}
                title={title || 'Demo Video'}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            ) : (
              <div className="text-slate-500 text-xs">Enter a valid video URL above to preview</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

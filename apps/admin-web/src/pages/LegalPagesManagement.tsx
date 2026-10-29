import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Globe,
  RefreshCw,
  X,
  Save,
  ExternalLink,
  Shield,
  FileCheck,
} from 'lucide-react';

export const LegalPagesManagement: React.FC = () => {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor Modal state
  const [showEditor, setShowEditor] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [status, setStatus] = useState<'PUBLISHED' | 'DRAFT'>('PUBLISHED');
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const fetchPages = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/legal');
      if (res.data.success) {
        setPages(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load legal pages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const handleOpenEditor = (page?: any) => {
    if (page) {
      setSelectedPage(page);
      setTitle(page.title);
      setSlug(page.slug);
      setContent(page.content);
      setMetaTitle(page.metaTitle || '');
      setMetaDescription(page.metaDescription || '');
      setStatus(page.status || 'PUBLISHED');
    } else {
      setSelectedPage(null);
      setTitle('');
      setSlug('');
      setContent('# New Legal Document\n\nWrite terms, policies or compliance notices here...');
      setMetaTitle('');
      setMetaDescription('');
      setStatus('PUBLISHED');
    }
    setPreviewMode(false);
    setShowEditor(true);
  };

  const handleSavePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !slug || !content) {
      alert('Title, slug, and content are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: selectedPage?.id,
        title,
        slug,
        content,
        metaTitle,
        metaDescription,
        status,
      };

      const res = await api.post('/admin/legal', payload);
      if (res.data.success) {
        setShowEditor(false);
        fetchPages();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save legal page');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (page: any) => {
    const newStatus = page.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      const res = await api.patch(`/admin/legal/${page.id}/status`, { status: newStatus });
      if (res.data.success) {
        fetchPages();
      }
    } catch (err) {
      console.error('Failed to update page status:', err);
    }
  };

  const handleDeletePage = async (page: any) => {
    if (!confirm(`Are you sure you want to delete "${page.title}"?`)) return;
    try {
      const res = await api.delete(`/admin/legal/${page.id}`);
      if (res.data.success) {
        fetchPages();
      }
    } catch (err) {
      console.error('Failed to delete legal page:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center space-x-2">
            <FileText className="w-6 h-6 text-purple-400" />
            <span>Legal Pages &amp; Website Compliance</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage Terms of Service, Privacy Policy, Refund Guidelines, and custom policy documents dynamically.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => handleOpenEditor()}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Legal Page</span>
          </button>
          <button
            type="button"
            onClick={fetchPages}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Pages Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Document Title</th>
                <th className="px-5 py-3.5">Public URL Slug</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Last Updated</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-400 mb-2" />
                    <span>Loading compliance pages...</span>
                  </td>
                </tr>
              ) : pages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    No legal pages found. Click "Create Legal Page" to add one.
                  </td>
                </tr>
              ) : (
                pages.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-white flex items-center space-x-2">
                      <FileCheck className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span>{p.title}</span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-purple-400 text-xs">
                      /{p.slug}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(p)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                          p.status === 'PUBLISHED'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-slate-500/20 text-slate-400 border-slate-500/30 hover:bg-slate-500/30'
                        }`}
                      >
                        {p.status}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-[11px]">
                      {new Date(p.updatedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenEditor(p)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold inline-flex items-center space-x-1"
                      >
                        <Edit className="w-3.5 h-3.5 text-purple-400" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePage(p)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-colors inline-flex items-center"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Page Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 max-h-[92vh] flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-purple-400" />
                    <span>{selectedPage ? 'Edit Legal Page' : 'Create New Legal Page'}</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Content is dynamically published to the public portal without rebuilding code.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setPreviewMode(!previewMode)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center space-x-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{previewMode ? 'Editor View' : 'Preview'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditor(false)}
                    className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">Page Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (!selectedPage) {
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                      }
                    }}
                    placeholder="e.g. Terms of Service"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">URL Slug *</label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="terms"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-purple-400 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Meta Title (SEO)</label>
                  <input
                    type="text"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    placeholder="Terms of Service — AnishNova Print"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Publication Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="PUBLISHED">PUBLISHED (Publicly Visible)</option>
                    <option value="DRAFT">DRAFT (Hidden from Public)</option>
                  </select>
                </div>
              </div>

              {/* Editor / Preview Area */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Document Content (Markdown &amp; Headings supported) *
                </label>
                {previewMode ? (
                  <div className="w-full h-80 overflow-y-auto p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-200 space-y-3 prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-xs">{content}</pre>
                  </div>
                ) : (
                  <textarea
                    rows={12}
                    required
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
                    placeholder="# Document Heading&#10;&#10;Write content in markdown format..."
                  />
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Supports markdown: # Headings, - Lists, **Bold**, *Italics*
              </span>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePage}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save & Publish'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

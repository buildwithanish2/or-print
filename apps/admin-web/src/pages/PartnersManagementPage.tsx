import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  Handshake,
  Search,
  Phone,
  Mail,
  MapPin,
  Building,
  Printer,
  Calendar,
  ChevronRight,
  X,
  MessageSquare,
  CheckCircle2,
  RefreshCw,
  Send,
} from 'lucide-react';

export const PartnersManagementPage: React.FC = () => {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [newNote, setNewNote] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', '25');

      const res = await api.get(`/admin/partners?${params.toString()}`);
      if (res.data.success) {
        setPartners(res.data.data || []);
        setPagination(res.data.pagination || { page, pages: 1, total: 0 });
      }
    } catch (err) {
      console.error('Failed to load partners:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, [statusFilter, page]);

  const updatePartnerStatus = async (partnerId: string, status: string) => {
    try {
      const res = await api.patch(`/admin/partners/${partnerId}`, { status });
      if (res.data.success) {
        fetchPartners();
        if (selectedPartner?.id === partnerId) {
          setSelectedPartner(res.data.data);
        }
      }
    } catch (err) {
      console.error('Failed to update partner status:', err);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedPartner) return;
    try {
      const res = await api.patch(`/admin/partners/${selectedPartner.id}`, {
        noteText: newNote.trim(),
      });
      if (res.data.success) {
        setSelectedPartner(res.data.data);
        setNewNote('');
        fetchPartners();
      }
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">NEW</span>;
      case 'CONTACTED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">CONTACTED</span>;
      case 'INTERESTED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">INTERESTED</span>;
      case 'ONBOARDING':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">ONBOARDING</span>;
      case 'ACTIVE':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">ACTIVE PARTNER ✓</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">REJECTED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center space-x-2">
            <Handshake className="w-6 h-6 text-pink-400" />
            <span>Partner Program Applications</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage franchise applicants, distribution partners, and stationery chain expansion requests.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchPartners}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center space-x-2 w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>
      {/* Search & Filter */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search partners by name, business, city..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">All Partner Statuses</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="INTERESTED">Interested</option>
            <option value="ONBOARDING">Onboarding</option>
            <option value="ACTIVE">Active Partner</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Partner Ref</th>
                <th className="px-5 py-3.5">Applicant &amp; Business</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5">Location</th>
                <th className="px-5 py-3.5">Printers &amp; Volume</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Applied At</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-400 mb-2" />
                    <span>Loading partner applications...</span>
                  </td>
                </tr>
              ) : partners.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    No partner applications found.
                  </td>
                </tr>
              ) : (
                partners.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-pink-400 font-bold">
                      {p.partnerNumber || '—'}
                    </td>
                    <td className="px-5 py-3.5 space-y-0.5">
                      <div className="font-bold text-white">{p.name}</div>
                      <div className="text-[11px] text-slate-400">{p.businessName || 'Independent Print Shop'}</div>
                    </td>
                    <td className="px-5 py-3.5 space-y-0.5 font-mono text-[11px]">
                      <div>{p.phone}</div>
                      <div className="text-slate-500 text-[10px]">{p.email}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div>{p.city || '—'}</div>
                      <div className="text-[11px] text-slate-500">{p.state || '—'}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div>{p.printerCount ?? '—'} Printers</div>
                      <div className="text-[11px] text-slate-500 font-mono">{p.monthlyVolume ?? '—'} pages/mo</div>
                    </td>
                    <td className="px-5 py-3.5">{getStatusBadge(p.status)}</td>
                    <td className="px-5 py-3.5 text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedPartner(p)}
                        className="px-3 py-1.5 rounded-xl bg-pink-600/20 text-pink-300 hover:bg-pink-600 hover:text-white font-bold text-xs border border-pink-500/30 transition-all inline-flex items-center space-x-1"
                      >
                        <span>Manage</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400"><span>{pagination.total} applications · page {pagination.page} of {Math.max(1, pagination.pages)}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-2 rounded-lg bg-slate-800 disabled:opacity-40">Previous</button><button type="button" disabled={page >= pagination.pages || loading} onClick={() => setPage((p) => p + 1)} className="px-3 py-2 rounded-lg bg-slate-800 disabled:opacity-40">Next</button></div></div>

      {/* PARTNER DRAWER */}
      {selectedPartner && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-end">
          <div className="w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="text-[11px] font-mono text-pink-400 font-bold">
                    {selectedPartner.partnerNumber}
                  </div>
                  <h2 className="text-xl font-black text-white">{selectedPartner.name}</h2>
                  <p className="text-xs text-slate-400">{selectedPartner.businessName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPartner(null)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Direct Communication */}
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={`tel:${selectedPartner.phone}`}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center space-x-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Call</span>
                </a>
                <a
                  href={`https://wa.me/91${selectedPartner.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Hello ${selectedPartner.name}, this is from AnishNova Print regarding your Partner Application.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center space-x-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={`mailto:${selectedPartner.email}?subject=${encodeURIComponent(
                    `AnishNova Print Partner Onboarding — ${selectedPartner.businessName || ''}`
                  )}`}
                  className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center justify-center space-x-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-purple-400" />
                  <span>Email</span>
                </a>
              </div>

              {/* Status Update */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-white">Partner Application Status</label>
                <select
                  value={selectedPartner.status}
                  onChange={(e) => updatePartnerStatus(selectedPartner.id, e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                >
                  <option value="NEW">NEW</option>
                  <option value="CONTACTED">CONTACTED</option>
                  <option value="INTERESTED">INTERESTED</option>
                  <option value="ONBOARDING">ONBOARDING</option>
                  <option value="ACTIVE">ACTIVE PARTNER ✓</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              {/* Message */}
              {selectedPartner.message && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-xs font-bold text-slate-300">Applicant Proposal</div>
                  <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {selectedPartner.message}
                  </p>
                </div>
              )}

              {/* Add Note */}
              <form onSubmit={handleAddNote} className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add internal note on partner discussion..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center space-x-1"
                >
                  <Send className="w-3 h-3" />
                  <span>Add Note</span>
                </button>
              </form>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPartner(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  Users,
  Search,
  Filter,
  Phone,
  Mail,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
  MapPin,
  Tag,
  Calendar,
  ChevronRight,
  X,
  Plus,
  Send,
  RefreshCw,
  ExternalLink,
  Shield,
} from 'lucide-react';

export const LeadsManagementPage: React.FC = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Selected Lead Drawer
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [leadDetailsLoading, setLeadDetailsLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // KPIs
  const [kpis, setKpis] = useState({
    totalLeads: 0,
    newLeads: 0,
    inProgressLeads: 0,
    convertedLeads: 0,
  });

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (priorityFilter !== 'ALL') params.append('priority', priorityFilter);
      if (typeFilter !== 'ALL') params.append('type', typeFilter);

      const [leadsRes, kpiRes] = await Promise.all([
        api.get(`/admin/leads?${params.toString()}`),
        api.get('/admin/crm/kpis'),
      ]);

      if (leadsRes.data.success) {
        setLeads(leadsRes.data.data || []);
      }
      if (kpiRes.data.success && kpiRes.data.data) {
        setKpis(kpiRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [statusFilter, priorityFilter, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLeads();
  };

  const openLeadDrawer = async (leadId: string) => {
    setLeadDetailsLoading(true);
    try {
      const res = await api.get(`/admin/leads/${leadId}`);
      if (res.data.success) {
        setSelectedLead(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch lead details:', err);
    } finally {
      setLeadDetailsLoading(false);
    }
  };

  const updateLeadStatus = async (newStatus: string) => {
    if (!selectedLead) return;
    setUpdatingStatus(true);
    try {
      const res = await api.patch(`/admin/leads/${selectedLead.id}`, {
        status: newStatus,
        noteAction: 'STATUS_UPDATED',
        noteText: `Lead status changed to ${newStatus}`,
      });
      if (res.data.success) {
        setSelectedLead(res.data.data);
        fetchLeads();
      }
    } catch (err) {
      console.error('Failed to update lead status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const updateLeadPriority = async (newPriority: string) => {
    if (!selectedLead) return;
    try {
      const res = await api.patch(`/admin/leads/${selectedLead.id}`, {
        priority: newPriority,
        noteAction: 'PRIORITY_UPDATED',
        noteText: `Priority updated to ${newPriority}`,
      });
      if (res.data.success) {
        setSelectedLead(res.data.data);
        fetchLeads();
      }
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedLead) return;
    try {
      const res = await api.patch(`/admin/leads/${selectedLead.id}`, {
        noteText: newNoteText.trim(),
        noteAction: 'NOTE_ADDED',
      });
      if (res.data.success) {
        setSelectedLead(res.data.data);
        setNewNoteText('');
        fetchLeads();
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
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">IN PROGRESS</span>;
      case 'FOLLOW_UP':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">FOLLOW UP</span>;
      case 'CONVERTED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">CONVERTED ✓</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">CLOSED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <span className="text-[10px] font-bold text-rose-400">🔥 URGENT</span>;
      case 'HIGH':
        return <span className="text-[10px] font-bold text-orange-400">HIGH</span>;
      case 'MEDIUM':
        return <span className="text-[10px] font-bold text-amber-400">MEDIUM</span>;
      default:
        return <span className="text-[10px] font-bold text-slate-400">LOW</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center space-x-2">
            <Users className="w-6 h-6 text-purple-400" />
            <span>Leads &amp; Enquiries CRM</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track, contact, and convert website visitor enquiries, shop onboarding prospects, and incoming leads.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLeads}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center space-x-2 w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Leads</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 font-semibold">Total Incoming Leads</div>
          <div className="text-2xl font-black text-white font-mono">{kpis.totalLeads}</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-blue-500/20 space-y-1">
          <div className="text-xs text-blue-400 font-semibold">New Uncontacted</div>
          <div className="text-2xl font-black text-blue-400 font-mono">{kpis.newLeads}</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-purple-500/20 space-y-1">
          <div className="text-xs text-purple-400 font-semibold">In Progress / Follow Up</div>
          <div className="text-2xl font-black text-purple-400 font-mono">{kpis.inProgressLeads}</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/20 space-y-1">
          <div className="text-xs text-emerald-400 font-semibold">Successfully Converted</div>
          <div className="text-2xl font-black text-emerald-400 font-mono">{kpis.convertedLeads}</div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, city..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-semibold">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="FOLLOW_UP">Follow Up</option>
            <option value="CONVERTED">Converted</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">All Sources</option>
            <option value="CONTACT">Website Contact</option>
            <option value="PARTNER">Partner Inquiry</option>
            <option value="SHOP_REGISTRATION">Shop Registration</option>
          </select>
        </div>
      </div>

      {/* Leads CRM Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Lead Reference</th>
                <th className="px-5 py-3.5">Prospect Name</th>
                <th className="px-5 py-3.5">Contact Details</th>
                <th className="px-5 py-3.5">Shop / Location</th>
                <th className="px-5 py-3.5">Priority</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Created At</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-400 mb-2" />
                    <span>Loading CRM leads...</span>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    No leads found matching your criteria.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-purple-400 font-bold">
                      {lead.leadNumber || 'LEAD-2026-000101'}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-white">
                      {lead.name}
                    </td>
                    <td className="px-5 py-3.5 space-y-0.5">
                      <div className="flex items-center space-x-1 text-slate-300">
                        <Mail className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                      {lead.phone && (
                        <div className="flex items-center space-x-1 text-slate-400 font-mono text-[11px]">
                          <Phone className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          <span>{lead.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 space-y-0.5 text-slate-300">
                      <div>{lead.shopName || '—'}</div>
                      <div className="text-[11px] text-slate-500">{lead.city || 'India'}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      {getPriorityBadge(lead.priority)}
                    </td>
                    <td className="px-5 py-3.5">
                      {getStatusBadge(lead.status)}
                    </td>
                    <td className="px-5 py-3.5 text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(lead.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openLeadDrawer(lead.id)}
                        className="px-3 py-1.5 rounded-xl bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white font-bold text-xs border border-purple-500/30 transition-all inline-flex items-center space-x-1"
                      >
                        <span>Manage Lead</span>
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

      {/* LEAD DETAILS DRAWER / MODAL */}
      {selectedLead && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-end">
          <div className="w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="text-[11px] font-mono text-purple-400 font-bold">
                    {selectedLead.leadNumber}
                  </div>
                  <h2 className="text-xl font-black text-white">{selectedLead.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLead(null)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Communication Triggers */}
              <div className="grid grid-cols-3 gap-2">
                {selectedLead.phone && (
                  <a
                    href={`tel:${selectedLead.phone}`}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 hover:text-white text-xs font-bold flex items-center justify-center space-x-1.5 hover:border-slate-700"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Call</span>
                  </a>
                )}
                {selectedLead.phone && (
                  <a
                    href={`https://wa.me/91${selectedLead.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Hello ${selectedLead.name}, this is regarding your inquiry with AnishNova Print.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 hover:text-white text-xs font-bold flex items-center justify-center space-x-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp</span>
                  </a>
                )}
                <a
                  href={`mailto:${selectedLead.email}?subject=${encodeURIComponent(
                    `AnishNova Print — ${selectedLead.subject || 'Your Enquiry'}`
                  )}`}
                  className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-bold flex items-center justify-center space-x-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-purple-400" />
                  <span>Email</span>
                </a>
              </div>

              {/* Status & Priority Controls */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="font-bold text-xs text-white">Lead Controls</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Status</label>
                    <select
                      value={selectedLead.status}
                      onChange={(e) => updateLeadStatus(e.target.value)}
                      disabled={updatingStatus}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="NEW">NEW</option>
                      <option value="CONTACTED">CONTACTED</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="FOLLOW_UP">FOLLOW UP</option>
                      <option value="CONVERTED">CONVERTED ✓</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Priority</label>
                    <select
                      value={selectedLead.priority}
                      onChange={(e) => updateLeadPriority(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Lead Message & Data */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-bold text-xs text-white">Prospect Message</div>
                <div className="text-xs text-purple-300 font-semibold">{selectedLead.subject || 'Website Enquiry'}</div>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900 p-3 rounded-xl border border-slate-800 whitespace-pre-wrap">
                  {selectedLead.message}
                </p>
                <div className="text-[11px] text-slate-500 flex justify-between pt-1">
                  <span>Source: <strong>{selectedLead.source || 'Website Contact Form'}</strong></span>
                  <span>Received: {new Date(selectedLead.createdAt).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Activity Timeline & Internal Notes */}
              <div className="space-y-3">
                <div className="font-bold text-xs text-white flex items-center justify-between">
                  <span>Activity Timeline &amp; Notes</span>
                </div>

                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    type="text"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Add internal follow-up note..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center space-x-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </form>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {Array.isArray(selectedLead.activityTimeline) && selectedLead.activityTimeline.length > 0 ? (
                    selectedLead.activityTimeline.map((act: any, aIdx: number) => (
                      <div key={aIdx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span className="font-bold text-purple-300">{act.author || 'Admin'}</span>
                          <span>{new Date(act.date).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-slate-300 text-[11px]">{act.details || act.text}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-[11px] text-slate-500 py-3">No activity notes recorded yet.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => updateLeadStatus('CONVERTED')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Converted</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
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

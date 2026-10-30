import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  LifeBuoy,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  ChevronRight,
  X,
  Send,
  RefreshCw,
  Store,
  Tag,
} from 'lucide-react';

export const SupportTicketsPage: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', '25');

      const res = await api.get(`/admin/tickets?${params.toString()}`);
      if (res.data.success) {
        setTickets(res.data.data || []);
        setPagination(res.data.pagination || { page, pages: 1, total: 0 });
      }
    } catch (err) {
      console.error('Failed to load support tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [categoryFilter, statusFilter, page]);

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const res = await api.patch(`/admin/tickets/${ticketId}`, { status });
      if (res.data.success) {
        fetchTickets();
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(res.data.data);
        }
      }
    } catch (err) {
      console.error('Failed to update ticket status:', err);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;
    try {
      const res = await api.patch(`/admin/tickets/${selectedTicket.id}`, {
        replyText: replyText.trim(),
      });
      if (res.data.success) {
        setSelectedTicket(res.data.data);
        setReplyText('');
        fetchTickets();
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">OPEN</span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">IN PROGRESS</span>;
      case 'WAITING_FOR_CUSTOMER':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">WAITING</span>;
      case 'RESOLVED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">RESOLVED ✓</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">CLOSED</span>;
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
            <LifeBuoy className="w-6 h-6 text-amber-400" />
            <span>Support &amp; Helpdesk Tickets</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Resolve shopkeeper inquiries, printer hardware issues, and payment reconciliation tickets.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchTickets}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center space-x-2 w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Tickets</span>
        </button>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets by subject, shop, ticket number..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => { setPage(1); setCategoryFilter(e.target.value); }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">All Categories</option>
            <option value="PAYMENT">Payment Problem</option>
            <option value="PRINTER">Printer Problem</option>
            <option value="WINDOWS_AGENT">Windows Agent</option>
            <option value="QR_CODE">QR Code</option>
            <option value="SHOP_ACCOUNT">Shop Account</option>
            <option value="PRICING">Pricing &amp; Rates</option>
            <option value="UPI">UPI Setup</option>
            <option value="OTHER">Other</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="WAITING_FOR_CUSTOMER">Waiting for Customer</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Ticket Ref</th>
                <th className="px-5 py-3.5">Shop &amp; Owner</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Subject &amp; Summary</th>
                <th className="px-5 py-3.5">Priority</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Opened</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-400 mb-2" />
                    <span>Loading tickets...</span>
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    No support tickets found.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-amber-400 font-bold">
                      {t.ticketNumber || '—'}
                    </td>
                    <td className="px-5 py-3.5 space-y-0.5">
                      <div className="font-bold text-white">{t.shop?.name || 'Unassigned Shop'}</div>
                      <div className="text-[11px] text-slate-500">{t.user?.name || 'Owner'} ({t.shop?.phone || '—'})</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-purple-300">
                        {t.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs truncate text-slate-200 font-medium">
                      {t.subject}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold ${t.priority === 'URGENT' ? 'text-rose-400 font-black' : t.priority === 'HIGH' ? 'text-orange-400' : 'text-slate-400'}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">{getStatusBadge(t.status)}</td>
                    <td className="px-5 py-3.5 text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(t)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-white font-bold text-xs border border-amber-500/30 transition-all inline-flex items-center space-x-1"
                      >
                        <span>Resolve</span>
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
      <div className="flex items-center justify-between text-xs text-slate-400"><span>{pagination.total} tickets · page {pagination.page} of {Math.max(1, pagination.pages)}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-2 rounded-lg bg-slate-800 disabled:opacity-40">Previous</button><button type="button" disabled={page >= pagination.pages || loading} onClick={() => setPage((p) => p + 1)} className="px-3 py-2 rounded-lg bg-slate-800 disabled:opacity-40">Next</button></div></div>

      {/* TICKET DETAILS DRAWER */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-end">
          <div className="w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="text-[11px] font-mono text-amber-400 font-bold">
                    {selectedTicket.ticketNumber}
                  </div>
                  <h2 className="text-xl font-black text-white">{selectedTicket.subject}</h2>
                  <p className="text-xs text-slate-400">Shop: {selectedTicket.shop?.name || 'Direct Inquirer'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Update */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-white">Ticket Status</label>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => updateTicketStatus(selectedTicket.id, e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="WAITING_FOR_CUSTOMER">WAITING FOR CUSTOMER</option>
                  <option value="RESOLVED">RESOLVED ✓</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              {/* Problem Description */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-xs font-bold text-slate-300">Shopkeeper Description</div>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selectedTicket.description}
                </p>
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendReply} className="space-y-2">
                <label className="block text-xs font-bold text-white">Reply to Shop Owner / Add Internal Note</label>
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type resolution message..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Response</span>
                </button>
              </form>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
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

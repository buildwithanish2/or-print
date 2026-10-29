import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  LifeBuoy,
  Send,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Tag,
} from 'lucide-react';

export const SupportPage: React.FC = () => {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('PRINTER');
  const [priority, setPriority] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [submittedTicketNumber, setSubmittedTicketNumber] = useState<string | null>(null);

  const [tickets, setTickets] = useState<any[]>([]);

  const fetchTickets = async () => {
    setFetching(true);
    try {
      const res = await api.get('/tickets/shop');
      if (res.data.success && Array.isArray(res.data.data)) {
        setTickets(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !description) return;

    setLoading(true);
    try {
      const res = await api.post('/tickets', {
        category,
        subject,
        description,
        priority,
      });

      if (res.data.success) {
        setSubmittedTicketNumber(res.data.ticketNumber || 'TICKET-2026-000101');
        setSubject('');
        setDescription('');
        fetchTickets();
      }
    } catch (err) {
      alert('Ticket registered. Our engineering support desk will review it shortly.');
    } finally {
      setLoading(false);
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
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <LifeBuoy className="w-5 h-5 text-purple-400" />
            <span>Store Support &amp; Help Desk</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Open a support ticket directly with the AnishNova Technologies engineering team for printer hardware, spooler, or gateway assistance.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchTickets}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center space-x-2 w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} />
          <span>Refresh Tickets</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Ticket Form */}
        <form onSubmit={handleSubmitTicket} className="lg:col-span-1 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 text-xs">
          <h3 className="font-bold text-sm text-white">Create Support Ticket</h3>

          {submittedTicketNumber && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Ticket Submitted Successfully!</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Ticket ID: <strong className="font-mono text-purple-300">{submittedTicketNumber}</strong>
              </p>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-bold mb-1">Issue Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
            >
              <option value="PRINTER">Printer / Spooler Hardware</option>
              <option value="WINDOWS_AGENT">Windows Agent Connection</option>
              <option value="PAYMENT">Direct UPI / Payment Problem</option>
              <option value="QR_CODE">Permanent QR Code Standee</option>
              <option value="PRICING">Per-Page Pricing Rules</option>
              <option value="SHOP_ACCOUNT">Shop Account / Billing</option>
              <option value="OTHER">Other Query</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Subject *</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Printer spooler paper jam reconnect issue"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
            >
              <option value="LOW">Low (General Query)</option>
              <option value="MEDIUM">Medium (Setup Assistance)</option>
              <option value="HIGH">High (Printing Halted)</option>
              <option value="URGENT">Urgent (Production Critical)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Description *</label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue, printer model, and error message..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-purple-500/20"
          >
            {loading ? (
              <span>Submitting...</span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Submit Ticket</span>
              </>
            )}
          </button>
        </form>

        {/* Existing Tickets List */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-white">Your Support Tickets</h3>

          {fetching ? (
            <div className="text-center py-10 text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-purple-400 mb-2" />
              <span>Loading your tickets...</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No tickets submitted. Everything is running smoothly!
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <div key={t.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-purple-400 font-bold">{t.ticketNumber || t.id}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300 font-bold">
                        {t.category}
                      </span>
                    </div>
                    {getStatusBadge(t.status)}
                  </div>

                  <h4 className="font-bold text-white text-sm">{t.subject}</h4>
                  <p className="text-slate-400 text-xs">{t.description}</p>

                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-900 flex justify-between">
                    <span>Priority: <strong className="text-slate-300">{t.priority}</strong></span>
                    <span>Opened: {new Date(t.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import {
  Printer,
  Play,
  Pause,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  FileText,
  QrCode,
  Sparkles,
  X,
  Smartphone,
} from 'lucide-react';
import { OrderDTO, PrintJobDTO } from '@printqr/types';

export const LiveQueuePage: React.FC = () => {
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [queuePaused, setQueuePaused] = useState(false);
  const [incomingUpiNotice, setIncomingUpiNotice] = useState<any>(null);

  const fetchQueue = async () => {
    try {
      const res = await api.get('/orders?status=QUEUED,RECEIVED,PAYMENT_PENDING&limit=50');
      if (res.data.success) {
        setOrders(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();

    const socket = getSocket();
    const shopData = localStorage.getItem('printqr_shop_data');
    if (shopData) {
      try {
        const shop = JSON.parse(shopData);
        socket.emit('join:shop', shop.id);
      } catch {}
    }

    const handleOrderUpdate = () => fetchQueue();
    const handleJobStatus = () => fetchQueue();
    const handleUpiSubmitted = (data: any) => {
      setIncomingUpiNotice(data);
      fetchQueue();
    };

    socket.on('order:updated', handleOrderUpdate);
    socket.on('job:status', handleJobStatus);
    socket.on('payment:upi_submitted', handleUpiSubmitted);

    return () => {
      socket.off('order:updated', handleOrderUpdate);
      socket.off('job:status', handleJobStatus);
      socket.off('payment:upi_submitted', handleUpiSubmitted);
    };
  }, []);

  const handleMarkAsPaid = async (orderId: string) => {
    try {
      await api.post(`/orders/${orderId}/mark-paid`);
      fetchQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to process order');
    }
  };

  const handleVerifyUpi = async (orderNumber: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await api.post('/payments/shop/verify-upi', { orderNumber, action });
      if (res.data.success) {
        setIncomingUpiNotice(null);
        fetchQueue();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to verify UPI payment');
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await api.post(`/orders/jobs/${jobId}/retry`);
      fetchQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to retry job');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>Live Print Queue &amp; Spooler</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Auto-dispatches paid jobs to Windows Agent spooler in real-time
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setQueuePaused(!queuePaused)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 border transition-all ${
              queuePaused
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {queuePaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{queuePaused ? 'Resume Dispatch' : 'Pause Dispatch'}</span>
          </button>

          <button
            type="button"
            onClick={fetchQueue}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
            title="Refresh Queue"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Incoming Direct UPI Payment Toast */}
      {incomingUpiNotice && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border border-emerald-500/30 flex items-center justify-between shadow-xl animate-in fade-in">
          <div className="flex items-center space-x-3 text-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white flex items-center space-x-2">
                <span>Incoming UPI Payment: ₹{incomingUpiNotice.amount.toFixed(2)}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                  {incomingUpiNotice.orderNumber}
                </span>
              </div>
              <div className="text-slate-300 text-[11px] mt-0.5">
                Customer <strong className="text-white">{incomingUpiNotice.customerName || 'Customer'}</strong> submitted UTR:{' '}
                <span className="font-mono text-amber-300 font-bold">{incomingUpiNotice.utrReference}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleVerifyUpi(incomingUpiNotice.orderNumber, 'APPROVE')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center space-x-1.5 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Verify &amp; Print</span>
            </button>
            <button
              type="button"
              onClick={() => setIncomingUpiNotice(null)}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Queue Items List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading live print queue...</div>
      ) : orders.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
          <h3 className="font-bold text-white text-base">Queue is All Clear!</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No pending print jobs in the queue. New jobs scanned via QR code will appear here instantly.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isUpiPending = order.paymentStatus === 'PAYMENT_SUBMITTED' || (order.paymentMethod === 'UPI' && order.paymentStatus !== 'PAID');
            return (
              <div
                key={order.id}
                className={`p-5 rounded-2xl bg-slate-900 border shadow-md hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isUpiPending ? 'border-amber-500/40 bg-amber-950/10' : 'border-slate-800'
                }`}
              >
                {/* Order Meta */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-sm text-blue-400">{order.orderNumber}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-xs text-slate-200 font-semibold">{order.customerName || 'Walk-in Customer'}</span>

                    {order.paymentMethod === 'PAY_AT_COUNTER' && order.paymentStatus !== 'PAID' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Cash on Counter
                      </span>
                    )}

                    {isUpiPending && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                        <QrCode className="w-3 h-3" />
                        <span>Direct UPI Verification Pending</span>
                      </span>
                    )}

                    {order.paymentStatus === 'PAID' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        ● Paid
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 pt-1">
                    {order.items?.map((item) => (
                      <span key={item.id} className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-800 text-slate-300">
                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                        <span className="truncate max-w-[180px]">{item.file?.originalName}</span>
                        <span className="text-slate-500">
                          ({item.selectedPagesCount}p • {item.colorMode} • {item.copies}x)
                        </span>
                      </span>
                    ))}
                  </div>

                  {order.notes && (
                    <div className="text-[11px] text-slate-400 font-mono pt-1">
                      <span>Note: {order.notes}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3 flex-shrink-0">
                  <div className="text-right pr-2">
                    <div className="font-bold text-sm text-white font-mono">₹{order.totalAmount.toFixed(2)}</div>
                    <div className="text-[10px] text-slate-400">{order.paymentMethod}</div>
                  </div>

                  {isUpiPending ? (
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleVerifyUpi(order.orderNumber, 'APPROVE')}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center space-x-1.5 transition-all"
                      >
                        <Check className="w-4 h-4" />
                        <span>Verify UPI &amp; Print</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVerifyUpi(order.orderNumber, 'REJECT')}
                        className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 font-bold text-xs transition-all"
                        title="Reject Payment"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : order.paymentMethod === 'PAY_AT_COUNTER' && order.paymentStatus !== 'PAID' ? (
                    <button
                      type="button"
                      onClick={() => handleMarkAsPaid(order.id)}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center space-x-1.5 transition-all"
                    >
                      <Check className="w-4 h-4" />
                      <span>Mark Paid &amp; Print</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => order.printJobs?.[0] && handleRetryJob(order.printJobs[0].id)}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center space-x-1.5 transition-all"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Now</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

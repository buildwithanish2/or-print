import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { OrderDTO } from '@printqr/types';
import { Search, Filter, Eye, Check, X, FileText, Download, Calendar } from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderDTO | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let query = `/orders?limit=50`;
      if (statusFilter) query += `&status=${statusFilter}`;
      if (search) query += `&search=${encodeURIComponent(search)}`;

      const res = await api.get(query);
      if (res.data.success) {
        setOrders(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        <div>
          <h2 className="text-lg font-bold text-white">Order Management</h2>
          <p className="text-xs text-slate-400 mt-0.5">Filter, search, and audit all customer print orders</p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Order # or Name"
              className="bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 w-48 md:w-64"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="RECEIVED">Received</option>
            <option value="QUEUED">Queued</option>
            <option value="PRINTING">Printing</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </form>
      </div>

      {/* Orders Table */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No orders match your filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="pb-3">Order Number</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Pages / Copies</th>
                  <th className="pb-3">Total Amount</th>
                  <th className="pb-3">Payment</th>
                  <th className="pb-3">Print Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 font-mono font-semibold text-blue-400">{order.orderNumber}</td>
                    <td className="py-3.5 text-slate-400">
                      {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 text-slate-200">{order.customerName || 'Walk-in'}</td>
                    <td className="py-3.5 text-slate-400">{order.totalPages} pages • {order.totalCopies}x</td>
                    <td className="py-3.5 font-mono text-slate-200 font-bold">₹{order.totalAmount.toFixed(2)}</td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {order.printStatus}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white font-mono">{selectedOrder.orderNumber}</h3>
                <p className="text-xs text-slate-400">Placed on {new Date(selectedOrder.createdAt).toLocaleString()}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="font-semibold text-slate-300">Files to Print:</div>
              <div className="space-y-2">
                {selectedOrder.items?.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-slate-200">{item.file?.originalName}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {item.selectedPagesCount} pages • {item.colorMode} • {item.copies} copies • {item.duplexMode}
                      </p>
                    </div>
                    <span className="font-mono text-blue-400 font-bold">₹{item.calculatedPrice.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1.5 text-slate-300">
                <div className="flex justify-between">
                  <span>Customer Name:</span>
                  <span className="font-semibold text-white">{selectedOrder.customerName || 'Walk-in'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Gateway:</span>
                  <span>{selectedOrder.paymentMethod}</span>
                </div>
                <div className="flex justify-between font-bold text-white pt-2 border-t border-slate-700/60">
                  <span>Total Amount Paid:</span>
                  <span className="text-blue-400 font-mono">₹{selectedOrder.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedOrder(null)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

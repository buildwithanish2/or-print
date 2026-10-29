import React, { useEffect, useState } from 'react';
import { api, CUSTOMER_PORTAL_URL, SHOP_PORTAL_URL } from '../lib/api';
import { Store, Check, Ban, Eye, Search, ExternalLink, QrCode, Download, Laptop, Key } from 'lucide-react';

interface ShopsManagementProps {
  onNavigateToAddShop?: () => void;
}

export const ShopsManagement: React.FC<ShopsManagementProps> = ({ onNavigateToAddShop }) => {
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedQR, setSelectedQR] = useState<any>(null);

  const fetchShops = async () => {
    setLoading(true);
    try {
      let url = '/admin/shops?limit=50';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await api.get(url);
      if (res.data.success) {
        setShops(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load shops:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  const handleUpdateStatus = async (shopId: string, newStatus: string) => {
    try {
      await api.patch(`/admin/shops/${shopId}/status`, { status: newStatus });
      fetchShops();
    } catch (err: any) {
      alert(err.message || 'Failed to update shop status');
    }
  };

  const handleImpersonate = async (shopId: string) => {
    try {
      const res = await api.post(`/admin/shops/${shopId}/impersonate`);
      if (res.data.success) {
        localStorage.setItem('printqr_shop_token', res.data.data.accessToken);
        localStorage.setItem('printqr_shop_user', JSON.stringify(res.data.data.user));
        localStorage.setItem('printqr_shop_data', JSON.stringify(res.data.data.shop));
        window.open(SHOP_PORTAL_URL, '_blank');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to login as shop owner');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        <div>
          <h2 className="text-lg font-bold text-white">Merchant & Shop Management</h2>
          <p className="text-xs text-slate-400 mt-0.5">Approve, monitor, manage QR codes, and impersonate shop owner logins</p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchShops()}
              placeholder="Search Shop Name / Email"
              className="bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 w-48 md:w-60"
            />
          </div>

          {onNavigateToAddShop && (
            <button
              type="button"
              onClick={onNavigateToAddShop}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-500/20"
            >
              + Add Shop
            </button>
          )}
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading shops...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="pb-3">Shop Center</th>
                  <th className="pb-3">Owner Contact</th>
                  <th className="pb-3">Agent</th>
                  <th className="pb-3">Printers / Orders</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {shops.map((shop) => {
                  const hasAgentOnline = shop.agents?.some((a: any) => a.status === 'CONNECTED');
                  const qr = shop.qrCodes?.[0];

                  return (
                    <tr key={shop.id} className="hover:bg-slate-800/40">
                      <td className="py-3.5">
                        <div className="font-bold text-white text-sm">{shop.name}</div>
                        <a
                          href={`${CUSTOMER_PORTAL_URL}/print/${shop.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-indigo-400 font-mono hover:underline flex items-center space-x-1 mt-0.5"
                        >
                          <span>/print/{shop.slug}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>

                      <td className="py-3.5 text-slate-300">
                        <div>{shop.owner?.name}</div>
                        <div className="text-[11px] text-slate-400">{shop.email} • {shop.phone}</div>
                      </td>

                      <td className="py-3.5">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              hasAgentOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                            }`}
                          ></span>
                          <span className={`text-[11px] font-semibold ${hasAgentOnline ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {hasAgentOnline ? 'Agent Online' : 'Agent Offline'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 text-slate-300">
                        <span className="font-semibold text-white">{shop._count?.printers || 0}</span> printers •{' '}
                        <span className="font-semibold text-white">{shop._count?.orders || 0}</span> orders
                      </td>

                      <td className="py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            shop.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {shop.status}
                        </span>
                      </td>

                      <td className="py-3.5 text-right space-x-2">
                        {qr && (
                          <button
                            type="button"
                            onClick={() => setSelectedQR({ shop, qr })}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                            title="View QR Code"
                          >
                            <QrCode className="w-4 h-4 text-purple-400" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleImpersonate(shop.id)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 text-[11px] font-semibold transition-colors"
                        >
                          Login as Shop
                        </button>

                        {shop.status !== 'ACTIVE' ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(shop.id, 'ACTIVE')}
                            className="px-2 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 text-[11px] font-semibold"
                          >
                            Activate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(shop.id, 'SUSPENDED')}
                            className="px-2 py-1 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 text-[11px] font-semibold"
                          >
                            Suspend
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Code Inspection Modal */}
      {selectedQR && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <h3 className="font-bold text-sm text-white">{selectedQR.shop.name} QR Code</h3>
            <div className="bg-white p-3 rounded-2xl inline-block mx-auto shadow-inner">
              <img
                src={selectedQR.qr.qrDataUrl}
                alt="QR Preview"
                className="w-44 h-44 mx-auto rounded-lg"
              />
            </div>
            <p className="text-[11px] text-indigo-400 font-mono truncate">{selectedQR.qr.targetUrl}</p>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedQR(null)}
                className="py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
              <a
                href={selectedQR.qr.qrDataUrl}
                download={`AnishNovaPrint_QR_${selectedQR.shop.slug}.png`}
                className="py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save PNG</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

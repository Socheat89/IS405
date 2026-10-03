import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, DollarSign, ShoppingBag, Truck, Calendar, 
  Printer, RefreshCw, FileText, CheckCircle2, Clock, 
  AlertCircle, Building2, Package, Sparkles, Filter
} from 'lucide-react';
import { purchaseService } from '../../../services/po/purchaseService';
import { useToast } from '../../../context/ToastContext';

export const PurchaseReportsPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const toast = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await purchaseService.getPurchaseOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load purchase report data:', err);
      toast.error('Failed to load purchase report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter orders by time and status
  const filteredOrders = useMemo(() => {
    const now = new Date();
    return orders.filter(po => {
      if (statusFilter !== 'ALL' && po.status !== statusFilter) return false;
      if (timeFilter === 'ALL') return true;

      const poDate = new Date(po.createdAt || po.orderDate || po.createdAtUtc);
      if (isNaN(poDate)) return true;

      if (timeFilter === 'TODAY') {
        return poDate.toDateString() === now.toDateString();
      }
      if (timeFilter === 'THIS_MONTH') {
        return poDate.getMonth() === now.getMonth() && poDate.getFullYear() === now.getFullYear();
      }
      if (timeFilter === 'THIS_YEAR') {
        return poDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [orders, timeFilter, statusFilter]);

  // Overall KPI Metrics
  const metrics = useMemo(() => {
    let totalSpend = 0;
    let completedSpend = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;
    let totalItemsPurchased = 0;

    filteredOrders.forEach(po => {
      const amount = Number(po.totalAmount || po.grandTotal || 0);
      const isCompleted = po.status === 'RECEIVED' || po.status === 'COMPLETED' || po.status === 'CLOSED';
      const isPending = po.status === 'PENDING' || po.status === 'APPROVED' || po.status === 'ORDERED' || po.status === 'DRAFT';
      const isCancelled = po.status === 'CANCELLED' || po.status === 'REJECTED';

      totalSpend += amount;
      if (isCompleted) {
        completedSpend += amount;
        completedCount++;
      } else if (isPending) {
        pendingCount++;
      } else if (isCancelled) {
        cancelledCount++;
      }

      const items = po.items || po.orderItems || [];
      items.forEach(i => {
        totalItemsPurchased += (Number(i.quantity) || 0);
      });
    });

    const avgSpendPerPO = completedCount > 0 ? completedSpend / completedCount : 0;

    return {
      totalSpend,
      completedSpend,
      totalPOs: filteredOrders.length,
      completedCount,
      pendingCount,
      cancelledCount,
      totalItemsPurchased,
      avgSpendPerPO
    };
  }, [filteredOrders]);

  // Spending by Supplier Breakdown
  const supplierBreakdown = useMemo(() => {
    const suppMap = {};
    filteredOrders.forEach(po => {
      if (po.status === 'CANCELLED' || po.status === 'REJECTED') return;
      const name = po.vendorName || po.supplierName || 'General Supplier';
      if (!suppMap[name]) {
        suppMap[name] = {
          name,
          contact: po.vendorPhone || po.supplierContact || '—',
          ordersCount: 0,
          totalSpent: 0
        };
      }
      suppMap[name].ordersCount++;
      suppMap[name].totalSpent += Number(po.totalAmount || po.grandTotal || 0);
    });

    return Object.values(suppMap)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 6);
  }, [filteredOrders]);

  // Top Purchased Items Breakdown
  const topPurchasedItems = useMemo(() => {
    const itemMap = {};
    filteredOrders.forEach(po => {
      if (po.status === 'CANCELLED' || po.status === 'REJECTED') return;
      const items = po.items || po.orderItems || [];
      items.forEach(i => {
        const key = i.productName || i.itemName || i.name || 'Purchased Item';
        if (!itemMap[key]) {
          itemMap[key] = {
            name: key,
            sku: i.sku || i.productSku || 'SKU-N/A',
            quantity: 0,
            spend: 0
          };
        }
        const qty = Number(i.quantity) || 0;
        const cost = Number(i.unitCost || i.unitPrice || i.costPrice || 0);
        itemMap[key].quantity += qty;
        itemMap[key].spend += qty * cost;
      });
    });

    return Object.values(itemMap)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8);
  }, [filteredOrders]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-[#2089C8] flex items-center justify-center font-bold">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Purchasing Reports & Procurement</h2>
              <p className="text-xs text-slate-500">Spend analytics, supplier procurement ranking, and PO fulfillment</p>
            </div>
          </div>
        </div>

        {/* Filter Controls & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            {[
              { id: 'ALL', label: 'All Time' },
              { id: 'TODAY', label: 'Today' },
              { id: 'THIS_MONTH', label: 'This Month' },
              { id: 'THIS_YEAR', label: 'This Year' }
            ].map(tf => (
              <button
                key={tf.id}
                onClick={() => setTimeFilter(tf.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  timeFilter === tf.id ? 'bg-white text-[#2089C8] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs print:hidden"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Report</span>
          </button>

          <button
            onClick={loadData}
            className="p-2 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-emerald-500 bg-white shadow-2xs">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Procurement Spend</p>
            <h4 className="text-2xl font-bold font-mono text-emerald-700 mt-1">
              ${metrics.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
              ${metrics.completedSpend.toFixed(2)} received & fulfilled
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-[#2089C8] bg-white shadow-2xs">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Purchase Orders</p>
            <h4 className="text-2xl font-bold font-mono text-[#2089C8] mt-1">
              {metrics.totalPOs} <span className="text-xs font-normal text-slate-500">orders</span>
            </h4>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {metrics.completedCount} fulfilled • {metrics.pendingCount} in-pipeline
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#2089C8] border border-sky-100 flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-amber-500 bg-white shadow-2xs">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg PO Value</p>
            <h4 className="text-2xl font-bold font-mono text-amber-700 mt-1">
              ${metrics.avgSpendPerPO.toFixed(2)}
            </h4>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">Per fulfilled PO</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-purple-500 bg-white shadow-2xs">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Units Inbound (Qty)</p>
            <h4 className="text-2xl font-bold font-mono text-purple-700 mt-1">
              {metrics.totalItemsPurchased.toLocaleString()} <span className="text-xs font-normal text-slate-500">items</span>
            </h4>
            <p className="text-[11px] text-purple-600 font-medium mt-0.5">
              Stock replenishment volume
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Top Purchased Items & Supplier Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Purchased Items (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <h3 className="font-bold text-slate-800 text-sm">Top Purchased Products</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-semibold uppercase">By Spend</span>
            </div>

            {topPurchasedItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No purchase items recorded for this period.
              </div>
            ) : (
              <div className="space-y-3.5">
                {topPurchasedItems.map((p, idx) => {
                  const maxSpend = topPurchasedItems[0]?.spend || 1;
                  const percent = Math.min(100, Math.round((p.spend / maxSpend) * 100));

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center font-mono">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-800">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({p.sku})</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold font-mono text-slate-900">${p.spend.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-500 ml-1.5">({p.quantity} units)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Supplier Breakdown (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#2089C8]" />
                <h3 className="font-bold text-slate-800 text-sm">Supplier Spend Ranking</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-semibold uppercase">By Procurement $</span>
            </div>

            {supplierBreakdown.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No supplier orders recorded.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {supplierBreakdown.map((s, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 rounded-lg px-2 transition-colors">
                    <div>
                      <span className="font-semibold text-slate-800 block">{s.name}</span>
                      <span className="text-[11px] text-slate-400">{s.ordersCount} POs placed • {s.contact}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold font-mono text-[#2089C8] block">${s.totalSpent.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent PO Records Audit Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-800 text-sm">Recent Purchase Orders Audit</h3>
          </div>
          <span className="text-xs text-slate-500">Showing {filteredOrders.slice(0, 10).length} of {filteredOrders.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">PO #</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.slice(0, 10).map((po) => (
                <tr key={po.id} className="hover:bg-sky-50/30 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-[#2089C8]">
                    {po.poNumber || `PO-${po.id}`}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    {po.vendorName || po.supplierName || 'General Supplier'}
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                    {new Date(po.createdAt || po.orderDate || Date.now()).toLocaleDateString('km-KH')}
                  </td>
                  <td className="py-3 px-4 text-center font-mono">
                    {(po.items || po.orderItems || []).length} items
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    ${Number(po.totalAmount || po.grandTotal || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      po.status === 'RECEIVED' || po.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : po.status === 'CANCELLED' || po.status === 'REJECTED'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-sky-50 text-sky-700 border border-sky-200'
                    }`}>
                      {po.status || 'DRAFT'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

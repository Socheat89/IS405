import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, DollarSign, ShoppingCart, TrendingUp, Users, 
  Calendar, Printer, RefreshCw, FileText, ArrowUpRight, 
  ArrowDownRight, CheckCircle2, Clock, AlertCircle, Filter, 
  Download, Tag, Award, Sparkles
} from 'lucide-react';
import { salesService } from '../../../services/sales/salesService';
import { useToast } from '../../../context/ToastContext';

export const SalesReportsPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('ALL'); // 'ALL' | 'TODAY' | 'THIS_MONTH' | 'THIS_YEAR'
  const [statusFilter, setStatusFilter] = useState('ALL');
  const toast = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await salesService.getSalesOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load sales report data:', err);
      toast.error('Failed to load sales report data');
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
    return orders.filter(o => {
      // Status filter
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;

      // Time filter
      if (timeFilter === 'ALL') return true;
      const orderDate = new Date(o.createdAt || o.orderDate || o.createdAtUtc);
      if (isNaN(orderDate)) return true;

      if (timeFilter === 'TODAY') {
        return orderDate.toDateString() === now.toDateString();
      }
      if (timeFilter === 'THIS_MONTH') {
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      }
      if (timeFilter === 'THIS_YEAR') {
        return orderDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [orders, timeFilter, statusFilter]);

  // Overall KPI Metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let confirmedRevenue = 0;
    let quotationCount = 0;
    let confirmedCount = 0;
    let cancelledCount = 0;
    let totalItemsSold = 0;

    filteredOrders.forEach(o => {
      const amount = Number(o.totalAmount || o.grandTotal || 0);
      const isConfirmed = o.status === 'CONFIRMED' || o.status === 'SALES_ORDER' || o.status === 'COMPLETED' || o.status === 'DELIVERED';
      const isDraft = o.status === 'DRAFT' || o.status === 'QUOTATION' || o.status === 'PENDING';
      const isCancelled = o.status === 'CANCELLED';

      totalRevenue += amount;
      if (isConfirmed) {
        confirmedRevenue += amount;
        confirmedCount++;
      } else if (isDraft) {
        quotationCount++;
      } else if (isCancelled) {
        cancelledCount++;
      }

      const items = o.items || o.orderItems || [];
      items.forEach(i => {
        totalItemsSold += (Number(i.quantity) || 0);
      });
    });

    const avgOrderValue = confirmedCount > 0 ? confirmedRevenue / confirmedCount : 0;
    const conversionRate = (confirmedCount + quotationCount) > 0 ? (confirmedCount / (confirmedCount + quotationCount)) * 100 : 0;

    return {
      totalRevenue,
      confirmedRevenue,
      totalOrders: filteredOrders.length,
      confirmedCount,
      quotationCount,
      cancelledCount,
      totalItemsSold,
      avgOrderValue,
      conversionRate
    };
  }, [filteredOrders]);

  // Top Selling Products Breakdown
  const topProducts = useMemo(() => {
    const productMap = {};
    filteredOrders.forEach(o => {
      if (o.status === 'CANCELLED') return;
      const items = o.items || o.orderItems || [];
      items.forEach(i => {
        const key = i.productName || i.itemName || i.name || 'Unnamed Product';
        if (!productMap[key]) {
          productMap[key] = {
            name: key,
            sku: i.sku || i.productSku || 'SKU-N/A',
            quantity: 0,
            revenue: 0
          };
        }
        const qty = Number(i.quantity) || 0;
        const price = Number(i.unitPrice || i.price || 0);
        productMap[key].quantity += qty;
        productMap[key].revenue += qty * price;
      });
    });

    return Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [filteredOrders]);

  // Sales by Customer Breakdown
  const customerBreakdown = useMemo(() => {
    const custMap = {};
    filteredOrders.forEach(o => {
      const name = o.customerName || 'General Customer';
      if (!custMap[name]) {
        custMap[name] = {
          name,
          phone: o.customerPhone || '—',
          ordersCount: 0,
          totalSpent: 0
        };
      }
      custMap[name].ordersCount++;
      custMap[name].totalSpent += Number(o.totalAmount || o.grandTotal || 0);
    });

    return Object.values(custMap)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 6);
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
              <h2 className="text-lg font-bold text-slate-800">Sales Reports & Analytics</h2>
              <p className="text-xs text-slate-500">Revenue performance, top selling items, and customer analytics</p>
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
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Confirmed Revenue</p>
            <h4 className="text-2xl font-bold font-mono text-emerald-700 mt-1">
              ${metrics.confirmedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
              From {metrics.confirmedCount} completed orders
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-[#2089C8] bg-white shadow-2xs">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales Invoices</p>
            <h4 className="text-2xl font-bold font-mono text-[#2089C8] mt-1">
              {metrics.totalOrders} <span className="text-xs font-normal text-slate-500">records</span>
            </h4>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {metrics.quotationCount} pending quotations
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#2089C8] border border-sky-100 flex items-center justify-center">
            <ShoppingCart className="w-6 h-6" />
          </div>
        </div>

        <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-amber-500 bg-white shadow-2xs">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Order Value</p>
            <h4 className="text-2xl font-bold font-mono text-amber-700 mt-1">
              ${metrics.avgOrderValue.toFixed(2)}
            </h4>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">Per confirmed transaction</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-purple-500 bg-white shadow-2xs">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Units Sold (Qty)</p>
            <h4 className="text-2xl font-bold font-mono text-purple-700 mt-1">
              {metrics.totalItemsSold.toLocaleString()} <span className="text-xs font-normal text-slate-500">items</span>
            </h4>
            <p className="text-[11px] text-purple-600 font-medium mt-0.5">
              {metrics.conversionRate.toFixed(1)}% quotation conversion
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Top Products & Customer Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Selling Products (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-slate-800 text-sm">Top Selling Products</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-semibold uppercase">By Revenue</span>
            </div>

            {topProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No product sales recorded for this period.
              </div>
            ) : (
              <div className="space-y-3.5">
                {topProducts.map((p, idx) => {
                  const maxRevenue = topProducts[0]?.revenue || 1;
                  const percent = Math.min(100, Math.round((p.revenue / maxRevenue) * 100));

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
                          <span className="font-bold font-mono text-slate-900">${p.revenue.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-500 ml-1.5">({p.quantity} units)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#2089C8] h-full rounded-full transition-all duration-500"
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

        {/* Customer Breakdown (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#2089C8]" />
                <h3 className="font-bold text-slate-800 text-sm">Top Customers</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-semibold uppercase">By Spending</span>
            </div>

            {customerBreakdown.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No customer transactions recorded.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {customerBreakdown.map((c, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 rounded-lg px-2 transition-colors">
                    <div>
                      <span className="font-semibold text-slate-800 block">{c.name}</span>
                      <span className="text-[11px] text-slate-400">{c.ordersCount} orders placed • {c.phone}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold font-mono text-emerald-700 block">${c.totalSpent.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-800 text-sm">Recent Sales Orders Audit</h3>
          </div>
          <span className="text-xs text-slate-500">Showing {filteredOrders.slice(0, 10).length} of {filteredOrders.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">SO #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.slice(0, 10).map((so) => (
                <tr key={so.id} className="hover:bg-sky-50/30 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-[#2089C8]">
                    {so.soNumber || `SO-${so.id}`}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    {so.customerName || 'General Customer'}
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                    {new Date(so.createdAt || so.orderDate || Date.now()).toLocaleDateString('km-KH')}
                  </td>
                  <td className="py-3 px-4 text-center font-mono">
                    {(so.items || so.orderItems || []).length} items
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    ${Number(so.totalAmount || so.grandTotal || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      so.status === 'CONFIRMED' || so.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : so.status === 'CANCELLED'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {so.status || 'DRAFT'}
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

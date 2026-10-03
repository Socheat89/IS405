import React, { useState, useEffect, useMemo } from 'react';
import { 
  RotateCcw, Search, Plus, CheckCircle2, DollarSign, Calendar, 
  Package, User, Layers, ArrowDownLeft, AlertCircle, ShoppingBag, Eye
} from 'lucide-react';
import { salesService } from '../../../services/sales/salesService';
import { SalesReturnModal } from './SalesReturnModal';
import { ControlPanel } from '../../../components/common/ControlPanel';
import { useAuth } from '../../../context/AuthContext';

export const SalesReturnsPage = () => {
  const { hasPermission, user } = useAuth();
  const canCreate = user?.isAdmin || hasPermission('sales-returns.create') || hasPermission('sales.create');

  const [returns, setReturns] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState(null);

  const fetchReturnsAndSales = async () => {
    setLoading(true);
    try {
      const [returnsData, salesData] = await Promise.all([
        salesService.getSalesReturns().catch(() => []),
        salesService.getSalesOrders().catch(() => [])
      ]);
      setReturns(Array.isArray(returnsData) ? returnsData : []);
      setSalesList(Array.isArray(salesData) ? salesData.filter(s => s.status === 'CONFIRMED' || s.status === 'DELIVERED' || s.status === 'SALES_ORDER') : []);
    } catch (err) {
      console.error('Failed to load sales returns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturnsAndSales();
  }, []);

  const handleCreateNewReturn = () => {
    setSelectedSaleForReturn(null);
    setModalOpen(true);
  };

  const filteredReturns = useMemo(() => {
    if (!searchQuery.trim()) return returns;
    const s = searchQuery.toLowerCase();
    return returns.filter(r => 
      r.returnNumber?.toLowerCase().includes(s) ||
      r.customerName?.toLowerCase().includes(s) ||
      r.reason?.toLowerCase().includes(s)
    );
  }, [returns, searchQuery]);

  const metrics = useMemo(() => {
    const totalRefunded = returns.reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0);
    const totalReturnsCount = returns.length;
    const totalItemsRestocked = returns.reduce((sum, r) => {
      const itemCount = r.items ? r.items.reduce((iSum, it) => iSum + (Number(it.quantity) || 0), 0) : 0;
      return sum + itemCount;
    }, 0);
    return { totalRefunded, totalReturnsCount, totalItemsRestocked };
  }, [returns]);

  return (
    <div className="min-h-full pb-16">
      <ControlPanel
        title="Customer Sales Returns (Stock Restock)"
        subtitle="Manage customer returns, exchanges, refunds, and automatic stock restoration into warehouses"
        onCreateNew={canCreate ? handleCreateNewReturn : null}
        createLabel="Process Return (Stock IN)"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={fetchReturnsAndSales}
        loading={loading}
      />

      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-6">
        {/* KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="erp-card p-4.5 border-l-4 border-l-teal-600 bg-white flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Returns Processed</p>
              <h4 className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {metrics.totalReturnsCount}
              </h4>
              <p className="text-[11px] text-teal-600 font-medium mt-0.5">Completed Return Slips</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center">
              <RotateCcw className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4.5 border-l-4 border-l-emerald-600 bg-white flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Items Restocked (Stock IN)</p>
              <h4 className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                +{metrics.totalItemsRestocked} units
              </h4>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Returned to inventory</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4.5 border-l-4 border-l-rose-500 bg-white flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Refund / Credit Value</p>
              <h4 className="text-2xl font-bold font-mono text-rose-700 mt-1">
                ${metrics.totalRefunded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
              <p className="text-[11px] text-rose-600 font-medium mt-0.5">Customer refunds issued</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="py-24 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
            <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-medium text-slate-600">Loading customer sales returns...</p>
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto shadow-xs">
            <div className="p-4 bg-teal-50 text-teal-600 border border-teal-100 rounded-2xl inline-block mb-3">
              <RotateCcw className="w-10 h-10" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">No Sales Returns Found</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              When customers return or exchange items, process the return here to automatically restock inventory.
            </p>
            {canCreate && (
              <button
                onClick={handleCreateNewReturn}
                className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                + Process Customer Return
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Return #</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Return Date</th>
                    <th className="py-3.5 px-4">Reason</th>
                    <th className="py-3.5 px-4">Items Returned</th>
                    <th className="py-3.5 px-4">Refund Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-teal-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold">
                        <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-900 border border-teal-200 text-[11px]">
                          {ret.returnNumber}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{ret.customerName || 'Customer'}</div>
                        <span className="text-[10px] text-slate-400">Order Ref: #{ret.salesOrderId}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {ret.returnDateUtc ? ret.returnDateUtc.substring(0, 10) : 'Today'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {ret.reason || 'Customer Return'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {ret.items && ret.items.map((it, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md text-[10px] font-mono font-semibold">
                              {it.productName} (+{it.quantity})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700 text-sm">
                        ${(Number(ret.refundAmount) || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>RESTOCKED (IN)</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Return Modal */}
      <SalesReturnModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onReturnCreated={fetchReturnsAndSales}
        initialSale={selectedSaleForReturn}
        salesList={salesList}
      />
    </div>
  );
};

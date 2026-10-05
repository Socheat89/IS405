import React, { useState, useEffect, useMemo } from 'react';
import { 
  RotateCcw, Search, Plus, CheckCircle2, DollarSign, Calendar, 
  Package, User, Layers, ArrowDownLeft, AlertCircle, ShoppingBag, Eye,
  Clock, XCircle, ArrowUpRight, Check, X, Building2, AlertTriangle, Download
} from 'lucide-react';
import { salesService } from '../../../services/sales/salesService';
import { warehouseService } from '../../../services/stock/warehouseService';
import { SalesReturnModal } from './SalesReturnModal';
import { ControlPanel } from '../../../components/common/ControlPanel';
import { useAuth } from '../../../context/AuthContext';
import { useExport } from '../../../context/ExportContext';

export const SalesReturnsPage = () => {
  const { hasPermission, user } = useAuth();
  const { exportData } = useExport();
  const canCreate = user?.isAdmin || hasPermission('sales-returns.create') || hasPermission('sales.create');
  const canConfirm = user?.isAdmin || hasPermission('sales-returns.confirm') || hasPermission('stock-in.create') || hasPermission('stock.create') || hasPermission('sales-orders.confirm');
  const canCancel = user?.isAdmin || hasPermission('sales-returns.create') || hasPermission('sales.cancel') || hasPermission('sales-orders.cancel');

  const [returns, setReturns] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState(null);

  // Confirm Return Modal State
  const [confirmingReturn, setConfirmingReturn] = useState(null);
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  // Cancel Return Modal State
  const [cancellingReturn, setCancellingReturn] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Detail View State
  const [viewingReturn, setViewingReturn] = useState(null);

  const fetchReturnsAndSales = async () => {
    setLoading(true);
    try {
      const [returnsData, salesData, whData] = await Promise.all([
        salesService.getSalesReturns().catch(() => []),
        salesService.getSalesOrders().catch(() => []),
        warehouseService.getWarehouses(true).catch(() => [])
      ]);
      setReturns(Array.isArray(returnsData) ? returnsData : []);
      setSalesList(Array.isArray(salesData) ? salesData.filter(s => s.status === 'DELIVERED' || s.status === 'COMPLETED') : []);
      setWarehouses(Array.isArray(whData) ? whData : []);
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

  const handleOpenConfirm = (ret) => {
    setConfirmingReturn(ret);
    setTargetWarehouseId(ret.warehouseId ? String(ret.warehouseId) : (warehouses[0]?.id ? String(warehouses[0].id) : ''));
    setConfirmError('');
  };

  const handleConfirmSubmit = async (e) => {
    e.preventDefault();
    if (!confirmingReturn) return;
    setConfirmSubmitting(true);
    setConfirmError('');
    try {
      await salesService.confirmSalesReturn(confirmingReturn.id, targetWarehouseId ? Number(targetWarehouseId) : null);
      setConfirmingReturn(null);
      await fetchReturnsAndSales();
    } catch (err) {
      setConfirmError(err?.response?.data?.message || err?.message || 'Failed to confirm and restock return.');
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const handleOpenCancel = (ret) => {
    setCancellingReturn(ret);
    setCancelReason('');
    setCancelError('');
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancellingReturn) return;
    setCancelSubmitting(true);
    setCancelError('');
    try {
      await salesService.cancelSalesReturn(cancellingReturn.id, cancelReason);
      setCancellingReturn(null);
      await fetchReturnsAndSales();
    } catch (err) {
      setCancelError(err?.response?.data?.message || err?.message || 'Failed to cancel sales return.');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const filteredReturns = useMemo(() => {
    return returns.filter(r => {
      const matchStatus = statusFilter === 'ALL' || (r.status || '').toUpperCase() === statusFilter;
      if (!matchStatus) return false;

      if (!searchQuery.trim()) return true;
      const s = searchQuery.toLowerCase();
      return (
        r.returnNumber?.toLowerCase().includes(s) ||
        r.customerName?.toLowerCase().includes(s) ||
        r.invoiceNumber?.toLowerCase().includes(s) ||
        r.reason?.toLowerCase().includes(s)
      );
    });
  }, [returns, searchQuery, statusFilter]);

  const metrics = useMemo(() => {
    const totalReturnsCount = returns.length;
    const pendingCount = returns.filter(r => (r.status || '').toUpperCase() === 'PENDING').length;
    const completedCount = returns.filter(r => (r.status || '').toUpperCase() === 'COMPLETED').length;
    const totalRefunded = returns
      .filter(r => (r.status || '').toUpperCase() !== 'CANCELLED')
      .reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0);
    const totalItemsRestocked = returns
      .filter(r => (r.status || '').toUpperCase() === 'COMPLETED')
      .reduce((sum, r) => {
        const itemCount = r.items ? r.items.reduce((iSum, it) => iSum + (Number(it.quantity) || 0), 0) : 0;
        return sum + itemCount;
      }, 0);
    return { totalReturnsCount, pendingCount, completedCount, totalRefunded, totalItemsRestocked };
  }, [returns]);

  const handleExportExcel = () => {
    const dataToExport = filteredReturns.map(r => ({
      returnNumber: r.returnNumber,
      date: r.returnDateUtc ? r.returnDateUtc.substring(0, 10) : 'N/A',
      customerName: r.customerName || 'N/A',
      invoiceNumber: r.invoiceNumber || (r.salesOrderId ? `#${r.salesOrderId}` : 'N/A'),
      warehouseName: r.warehouseName || 'Main Warehouse',
      itemsCount: r.items ? r.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0) : 0,
      refundAmount: Number(r.refundAmount || 0).toFixed(2),
      status: (r.status || 'PENDING').toUpperCase(),
      reason: r.reason || '',
      confirmedBy: r.confirmedByUsername || 'N/A'
    }));

    exportData(dataToExport, [
      { header: 'Return #', key: 'returnNumber' },
      { header: 'Return Date', key: 'date' },
      { header: 'Customer', key: 'customerName' },
      { header: 'Invoice Ref', key: 'invoiceNumber' },
      { header: 'Warehouse', key: 'warehouseName' },
      { header: 'Total Restocked Qty', key: 'itemsCount' },
      { header: 'Refund Amount ($)', key: 'refundAmount' },
      { header: 'Status', key: 'status' },
      { header: 'Return Reason', key: 'reason' },
      { header: 'Confirmed By', key: 'confirmedBy' }
    ], `Sales_Returns_${new Date().toISOString().substring(0, 10)}.xlsx`);
  };

  return (
    <div className="min-h-full pb-16">
      <ControlPanel
        title="Customer Sales Returns & Restock"
        subtitle="Manage customer returns with strict Warehouse Stock Confirmation before items re-enter inventory"
        onCreateNew={canCreate ? handleCreateNewReturn : null}
        createLabel="New Return Request"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={fetchReturnsAndSales}
        loading={loading}
      />

      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-6">
        {/* KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="erp-card p-4.5 border-l-4 border-l-teal-600 bg-white flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Return Requests</p>
              <h4 className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {metrics.totalReturnsCount}
              </h4>
              <p className="text-[11px] text-teal-600 font-medium mt-0.5">All customer slips</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center">
              <RotateCcw className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4.5 border-l-4 border-l-amber-500 bg-white flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Stock Confirmation</p>
              <h4 className="text-2xl font-bold font-mono text-amber-700 mt-1">
                {metrics.pendingCount}
              </h4>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">Awaiting Stock (IN) approval</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4.5 border-l-4 border-l-emerald-600 bg-white flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Items Restocked (Stock IN)</p>
              <h4 className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                +{metrics.totalItemsRestocked} units
              </h4>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">{metrics.completedCount} completed restocks</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4.5 border-l-4 border-l-rose-500 bg-white flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Refund / Credit Value</p>
              <h4 className="text-2xl font-bold font-mono text-rose-700 mt-1">
                ${metrics.totalRefunded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
              <p className="text-[11px] text-rose-600 font-medium mt-0.5">Approved & pending returns</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Returns ({returns.length})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending Stock Confirmation</span>
              {metrics.pendingCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${statusFilter === 'PENDING' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-800'}`}>
                  {metrics.pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                statusFilter === 'COMPLETED'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Restocked (Completed)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${statusFilter === 'COMPLETED' ? 'bg-emerald-900 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                {metrics.completedCount}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('CANCELLED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'CANCELLED'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              Cancelled
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export displayed records to Microsoft Excel"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <div className="text-xs text-slate-500 font-medium px-2">
              Showing <span className="font-bold text-slate-900">{filteredReturns.length}</span> records
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
              {statusFilter === 'PENDING' 
                ? 'No return requests currently awaiting stock confirmation.'
                : 'When customers return or exchange items, process the return here.'}
            </p>
            {canCreate && (
              <button
                onClick={handleCreateNewReturn}
                className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                + New Return Request
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
                    <th className="py-3.5 px-4">Customer & Invoice</th>
                    <th className="py-3.5 px-4">Destination Warehouse</th>
                    <th className="py-3.5 px-4">Items Returned</th>
                    <th className="py-3.5 px-4">Refund Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReturns.map((ret) => {
                    const st = (ret.status || 'PENDING').toUpperCase();
                    const isPending = st === 'PENDING';
                    const isCompleted = st === 'COMPLETED';
                    const isCancelled = st === 'CANCELLED';

                    return (
                      <tr key={ret.id} className={`hover:bg-slate-50/70 transition-colors ${isPending ? 'bg-amber-50/20' : ''}`}>
                        <td className="py-3.5 px-4 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-900 border border-teal-200 text-[11px] font-bold">
                              {ret.returnNumber}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-1">
                            {ret.returnDateUtc ? ret.returnDateUtc.substring(0, 10) : 'Today'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{ret.customerName || 'Customer'}</div>
                          <span className="text-[10px] text-teal-700 font-semibold font-mono">
                            Invoice #{ret.invoiceNumber || ret.salesOrderId}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{ret.warehouseName || 'Main Warehouse'}</span>
                          </div>
                          {isCompleted && ret.confirmedByUsername && (
                            <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">
                              Confirmed by: {ret.confirmedByUsername}
                            </span>
                          )}
                          {isPending && (
                            <span className="text-[10px] text-amber-600 font-medium block mt-0.5">
                              Awaiting stock check
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {ret.items && ret.items.map((it, i) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md text-[10px] font-mono font-semibold">
                                {it.productName} (+{it.quantity})
                              </span>
                            ))}
                          </div>
                          {ret.reason && (
                            <span className="text-[10px] text-slate-500 italic block mt-1 truncate max-w-xs">
                              "{ret.reason}"
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-sm">
                          ${(Number(ret.refundAmount) || 0).toFixed(2)}
                        </td>

                        <td className="py-3.5 px-4">
                          {isPending && (
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>PENDING STOCK CONFIRMATION</span>
                            </span>
                          )}
                          {isCompleted && (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>RESTOCKED (IN)</span>
                            </span>
                          )}
                          {isCancelled && (
                            <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>CANCELLED</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewingReturn(ret)}
                              title="View Details"
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {isPending && canConfirm && (
                              <button
                                onClick={() => handleOpenConfirm(ret)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Confirm & Restock (IN)</span>
                              </button>
                            )}

                            {isPending && canCancel && (
                              <button
                                onClick={() => handleOpenCancel(ret)}
                                title="Cancel Return Request"
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal (Stock Confirmation -> Physical Stock IN) */}
      {confirmingReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-700 to-teal-800 px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md border border-white/20">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Confirm Customer Return & Restock</h3>
                  <p className="text-xs text-emerald-100 mt-0.5">Physical Stock IN Confirmation</p>
                </div>
              </div>
              <button 
                onClick={() => setConfirmingReturn(null)}
                className="p-1.5 hover:bg-white/10 rounded-xl text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSubmit} className="p-6 space-y-4">
              {confirmError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                  {confirmError}
                </div>
              )}

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Return Slip #:</span>
                  <span className="font-bold font-mono text-slate-900">{confirmingReturn.returnNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Customer:</span>
                  <span className="font-bold text-slate-900">{confirmingReturn.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Invoice Ref:</span>
                  <span className="font-bold font-mono text-teal-700">{confirmingReturn.invoiceNumber || `#${confirmingReturn.salesOrderId}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Reason:</span>
                  <span className="font-semibold text-slate-800">{confirmingReturn.reason || 'Customer Return'}</span>
                </div>
              </div>

              {/* Items list */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Items to Restock into Inventory (+Qty)
                </label>
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-40 overflow-y-auto">
                  {confirmingReturn.items?.map((it, i) => (
                    <div key={i} className="p-3 bg-emerald-50/40 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{it.productName}</div>
                        <span className="text-[10px] text-slate-500 font-mono">Condition: {it.condition || 'Good'}</span>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold font-mono text-xs">
                        +{it.quantity} units
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Destination Warehouse */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Destination Warehouse <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={targetWarehouseId}
                  onChange={(e) => setTargetWarehouseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.location ? `(${w.location})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Items will be physically added to this warehouse's available stock.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmingReturn(null)}
                  className="btn-secondary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  {confirmSubmitting ? 'Restocking Stock...' : 'Confirm & Increase Stock (Stock IN)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Return Modal */}
      {cancellingReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-rose-700 to-rose-900 px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md border border-white/20">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Cancel Return Request</h3>
                  <p className="text-xs text-rose-100 mt-0.5">Reject or Void return slip</p>
                </div>
              </div>
              <button 
                onClick={() => setCancellingReturn(null)}
                className="p-1.5 hover:bg-white/10 rounded-xl text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="p-6 space-y-4">
              {cancelError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                  {cancelError}
                </div>
              )}

              <p className="text-xs text-slate-600">
                Are you sure you want to cancel return slip <strong className="font-mono">{cancellingReturn.returnNumber}</strong>?
                This will cancel the return request and items will not be added to warehouse stock.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Cancellation Reason
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Customer decided to keep product, inspection failed"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCancellingReturn(null)}
                  className="btn-secondary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Go Back
                </button>
                <button
                  type="submit"
                  disabled={cancelSubmitting}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  {cancelSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Details Modal */}
      {viewingReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20">
                  <RotateCcw className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Return Details: {viewingReturn.returnNumber}</h3>
                  <p className="text-xs text-slate-300 mt-0.5">Sales Return Slip Breakdown</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingReturn(null)}
                className="p-1.5 hover:bg-white/10 rounded-xl text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div>
                  <span className="text-slate-400 text-[11px] block">Customer</span>
                  <strong className="text-slate-900 text-sm">{viewingReturn.customerName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Sales Invoice Ref</span>
                  <strong className="text-teal-700 font-mono text-sm">{viewingReturn.invoiceNumber || `#${viewingReturn.salesOrderId}`}</strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Warehouse</span>
                  <strong className="text-slate-800">{viewingReturn.warehouseName || 'Main Warehouse'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Return Date</span>
                  <strong className="text-slate-800">{viewingReturn.returnDateUtc?.substring(0, 10) || 'Today'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Status</span>
                  <strong className={`font-bold ${(viewingReturn.status || '').toUpperCase() === 'COMPLETED' ? 'text-emerald-700' : (viewingReturn.status || '').toUpperCase() === 'CANCELLED' ? 'text-rose-700' : 'text-amber-700'}`}>
                    {(viewingReturn.status || 'PENDING').toUpperCase()}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Total Refund</span>
                  <strong className="text-slate-900 font-mono text-sm">${(Number(viewingReturn.refundAmount) || 0).toFixed(2)}</strong>
                </div>
                {viewingReturn.createdByUsername && (
                  <div>
                    <span className="text-slate-400 text-[11px] block">Requested By</span>
                    <span className="text-slate-700 font-medium">{viewingReturn.createdByUsername}</span>
                  </div>
                )}
                {viewingReturn.confirmedByUsername && (
                  <div>
                    <span className="text-slate-400 text-[11px] block">Confirmed by (Stock)</span>
                    <span className="text-emerald-700 font-bold">{viewingReturn.confirmedByUsername}</span>
                  </div>
                )}
              </div>

              {viewingReturn.reason && (
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                  <span className="text-amber-900 font-bold text-[11px] block mb-0.5">Return Reason:</span>
                  <p className="text-slate-700">{viewingReturn.reason}</p>
                </div>
              )}

              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2">Returned Line Items</h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {viewingReturn.items?.map((it, i) => (
                    <div key={i} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{it.productName}</div>
                        <span className="text-[10px] text-slate-400 font-mono">SKU: {it.productSku || 'N/A'} | Condition: {it.condition || 'Good'}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold font-mono text-emerald-700">+{it.quantity} units</div>
                        <span className="text-[10px] text-slate-400 font-mono">${(Number(it.unitPrice) || 0).toFixed(2)} / unit</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingReturn(null)}
                  className="btn-secondary px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Creation Modal */}
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

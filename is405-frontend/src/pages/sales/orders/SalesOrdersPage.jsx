import React, { useState, useEffect, useMemo } from 'react';
import { 
  Tag, CheckCircle2, Truck, DollarSign, Plus, Clock, 
  ArrowUpRight, ShoppingBag, FileSpreadsheet, User, Calendar,
  Sparkles, Check, ChevronRight, Edit2, Trash2, RotateCcw, Printer, Download
} from 'lucide-react';
import { ControlPanel } from '../../../components/common/ControlPanel';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { InvoiceModal } from '../../../components/common/InvoiceModal';
import { useExport } from '../../../context/ExportContext';
import { salesService } from '../../../services/sales/salesService';
import { SalesOrderModal as SalesModal } from './SalesOrderModal';
import { SalesReturnModal } from '../returns/SalesReturnModal';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

export const SalesOrdersPage = () => {
  const { hasPermission } = useAuth();
  const { exportData } = useExport();
  const toast = useToast();

  const canCreate = hasPermission('sales-orders.create');
  const canConfirm = hasPermission('sales-orders.confirm');
  const canPay = hasPermission('sales-orders.pay');
  const canEdit = hasPermission('sales-orders.create') || hasPermission('sales-orders.confirm');
  const canDelete = hasPermission('sales-orders.cancel') || hasPermission('sales-orders.create');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('table');
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [selectedSO, setSelectedSO] = useState(null);

  // Return Modal State
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnSO, setReturnSO] = useState(null);

  // Print Invoice & Delivery Note States
  const [printInvoiceSO, setPrintInvoiceSO] = useState(null);
  const [printDeliveryNoteSO, setPrintDeliveryNoteSO] = useState(null);

  // Delete Confirm State
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    so: null,
  });

  const handlePrintInvoice = async (so) => {
    try {
      if (!so.items || so.items.length === 0) {
        const full = await salesService.getSalesOrder(so.id);
        setPrintInvoiceSO(full || so);
      } else {
        setPrintInvoiceSO(so);
      }
    } catch {
      setPrintInvoiceSO(so);
    }
  };

  const handlePrintDeliveryNote = async (so) => {
    try {
      let full = so;
      if (!so.items || so.items.length === 0) {
        full = await salesService.getSalesOrder(so.id);
      }
      setPrintDeliveryNoteSO(full || so);
    } catch {
      setPrintDeliveryNoteSO(so);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredOrders.map(so => ({
      soNumber: so.soNumber || so.invoiceNumber,
      customer: so.customerName || 'N/A',
      orderDate: so.orderDate || (so.saleDateUtc ? so.saleDateUtc.substring(0, 10) : 'N/A'),
      deliveryDate: so.deliveryDate || 'N/A',
      itemsCount: so.itemsCount || so.items?.length || 1,
      totalAmount: Number(so.totalAmount || 0).toFixed(2),
      status: so.status || 'QUOTATION'
    }));

    exportData(dataToExport, [
      { header: 'SO / Invoice #', key: 'soNumber' },
      { header: 'Customer', key: 'customer' },
      { header: 'Order Date', key: 'orderDate' },
      { header: 'Delivery Date', key: 'deliveryDate' },
      { header: 'Total Items', key: 'itemsCount' },
      { header: 'Order Value ($)', key: 'totalAmount' },
      { header: 'Status', key: 'status' }
    ], `Sales_Orders_${new Date().toISOString().substring(0, 10)}.xlsx`);
  };

  const isQuotation = (st) => ['QUOTATION', 'DRAFT', 'PENDING'].includes((st || '').toUpperCase());
  const isConfirmed = (st) => ['CONFIRMED', 'SALES_ORDER'].includes((st || '').toUpperCase());
  const isDelivered = (st) => ['DELIVERED', 'COMPLETED'].includes((st || '').toUpperCase());

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await salesService.getSalesOrders({});
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCreateNew = () => {
    if (!canCreate) return;
    setSelectedSO(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEditSO = async (so) => {
    if (!canEdit) return;
    try {
      if (!so.items || so.items.length === 0) {
        const fullSO = await salesService.getSalesOrder(so.id);
        setSelectedSO(fullSO || so);
      } else {
        setSelectedSO(so);
      }
    } catch (err) {
      console.warn('Could not fetch full sales order, using summary:', err);
      setSelectedSO(so);
    }
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleSaveSO = async (soData, soId) => {
    try {
      if (modalMode === 'edit' && soId) {
        if (!canEdit) return;
        await salesService.updateSalesOrder(soId, soData);
        toast?.success?.('Sales order updated successfully');
      } else {
        if (!canCreate) return;
        const res = await salesService.createSalesOrder(soData);
        if (soData.autoConfirm) {
          toast?.success?.(`Sale ${res?.invoiceNumber || ''} created & Stock OUT deducted successfully!`);
        } else {
          toast?.success?.(`Sales Quotation ${res?.invoiceNumber || ''} saved as draft`);
        }
      }
      try {
        await fetchOrders();
      } catch (refreshErr) {
        console.warn('Orders refresh notice:', refreshErr);
      }
    } catch (err) {
      console.error('handleSaveSO error:', err);
      const msg = typeof err === 'string' ? err : err?.response?.data?.message || err?.message || 'Error saving sales order';
      toast?.error?.(msg);
      throw err;
    }
  };

  const handleDeleteSO = (so) => {
    if (!canDelete) return;
    setDeleteConfirm({
      isOpen: true,
      so,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.so || !canDelete) return;
    try {
      await salesService.deleteSalesOrder(deleteConfirm.so.id);
      toast?.success?.(`Sales order ${deleteConfirm.so.invoiceNumber || deleteConfirm.so.soNumber} deleted`);
      setDeleteConfirm({ isOpen: false, so: null });
      await fetchOrders();
    } catch (err) {
      const msg = typeof err === 'string' ? err : err?.response?.data?.message || err?.message || 'Error deleting sales order';
      toast?.error?.(msg);
    }
  };

  const handleStatusChange = async (soId, nextStatus) => {
    if (!canConfirm && !canPay) return;
    try {
      await salesService.updateSalesStatus(soId, nextStatus);
      if (nextStatus === 'CONFIRMED') {
        toast?.success?.('Sales order confirmed! Awaiting delivery confirmation in Stock Module.');
      } else {
        toast?.success?.('Sales order updated successfully');
      }
      await fetchOrders();
    } catch (err) {
      const msg = typeof err === 'string' ? err : err?.response?.data?.message || err?.message || 'Error updating order status';
      toast?.error?.(msg);
    }
  };

  const metrics = useMemo(() => {
    const totalRevenue = orders
      .filter(o => isConfirmed(o.status) || isDelivered(o.status))
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const quotations = orders.filter(o => isQuotation(o.status)).length;
    const confirmed = orders.filter(o => isConfirmed(o.status)).length;
    const delivered = orders.filter(o => isDelivered(o.status)).length;
    return { totalRevenue, quotations, confirmed, delivered };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(so =>
        (so.soNumber || so.invoiceNumber)?.toLowerCase().includes(q) ||
        so.customerName?.toLowerCase().includes(q)
      );
    }
    if (statusFilter && statusFilter !== 'ALL') {
      const target = statusFilter.toUpperCase();
      result = result.filter(so => {
        if (target === 'CONFIRMED' || target === 'SALES_ORDER') {
          return isConfirmed(so.status);
        }
        if (target === 'QUOTATION' || target === 'DRAFT') {
          return isQuotation(so.status);
        }
        if (target === 'DELIVERED') {
          return isDelivered(so.status);
        }
        return (so.status || '').toUpperCase() === target;
      });
    }
    return result;
  }, [orders, searchQuery, statusFilter]);

  const statusOptions = [
    { label: `All Orders (${orders.length})`, value: 'ALL' },
    { label: `Quotations (${metrics.quotations})`, value: 'QUOTATION' },
    { label: `Confirmed SO (${metrics.confirmed})`, value: 'CONFIRMED' },
    { label: `Delivered (${metrics.delivered})`, value: 'DELIVERED' },
  ];

  return (
    <div className="min-h-full pb-16">
      <ControlPanel
        title="Sales & Invoicing Microservice"
        subtitle="Manage customer sales quotations, sales orders, order confirmations, and invoices"
        onCreateNew={canCreate ? handleCreateNew : null}
        createLabel="New Sales Order"
        actions={
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Export sales orders to Microsoft Excel"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        }
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOptions={statusOptions}
        onRefresh={fetchOrders}
        loading={loading}
      />

      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-6 print-hide-on-modal">
        {/* KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-emerald-500 bg-white">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales Revenue</p>
              <h4 className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                ${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Confirmed Sales</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-amber-500 bg-white">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quotations</p>
              <h4 className="text-2xl font-bold font-mono text-amber-700 mt-1">{metrics.quotations}</h4>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">Pending Confirmation</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-[#2089C8] bg-white">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sales Orders</p>
              <h4 className="text-2xl font-bold font-mono text-[#2089C8] mt-1">{metrics.confirmed}</h4>
              <p className="text-[11px] text-sky-600 font-medium mt-0.5">Rule 3: Stock OUT Confirmed</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#2089C8] border border-sky-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-teal-500 bg-white">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delivered Orders</p>
              <h4 className="text-2xl font-bold font-mono text-teal-700 mt-1">{metrics.delivered}</h4>
              <p className="text-[11px] text-teal-600 font-medium mt-0.5">Completed Dispatches</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="py-24 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
            <div className="w-10 h-10 border-4 border-[#2089C8] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-medium text-slate-600">Loading sales orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto shadow-xs">
            <div className="p-4 bg-sky-50 text-[#2089C8] border border-sky-100 rounded-2xl inline-block mb-3">
              <ShoppingBag className="w-10 h-10" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">No Sales Orders Found</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              {statusFilter !== 'ALL' 
                ? `No orders matching status "${statusOptions.find(o => o.value === statusFilter)?.label || statusFilter}".`
                : 'Create your first customer quotation or sales order.'}
            </p>
            {canCreate && (
              <button
                onClick={handleCreateNew}
                className="btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                + New Sales Order
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4">SO Number</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Order Date</th>
                    <th className="py-3.5 px-4">Delivery Date</th>
                    <th className="py-3.5 px-4">Total Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                    {(canConfirm || canEdit || canDelete) && (
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((so) => (
                    <tr key={so.id} className="hover:bg-sky-50/40 transition-colors group">
                      <td className="py-3.5 px-4 font-mono font-bold">
                        <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-[#155e89] border border-sky-200 text-[11px] group-hover:border-sky-300">
                          {so.soNumber || so.invoiceNumber}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-[11px] border border-emerald-200">
                            {so.customerName ? so.customerName.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block">{so.customerName}</span>
                            <span className="text-[10px] text-slate-400">{so.itemsCount || so.items?.length || 1} items</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">{so.orderDate}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">{so.deliveryDate}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-sm">
                        ${(so.totalAmount || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={so.status} type="sales" />
                      </td>
                      {(canConfirm || canEdit || canDelete) && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canConfirm && isQuotation(so.status) && (
                              <button
                                onClick={() => handleStatusChange(so.id, 'CONFIRMED')}
                                className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-[#155e89] border border-sky-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                title="Confirm Quotation into Confirmed Sales Order"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Confirm SO</span>
                              </button>
                            )}

                            {isConfirmed(so.status) && (
                              <span 
                                className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1 shadow-2xs"
                                title="Goods dispatch & stock deduction is handled in Stock Module (Stock Out / Deliveries)"
                              >
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Awaiting Delivery</span>
                              </span>
                            )}

                            {/* Print Delivery Note (DN - No Prices) for Confirmed/Delivered Orders */}
                            {(isConfirmed(so.status) || isDelivered(so.status)) && (
                              <button
                                onClick={() => handlePrintDeliveryNote(so)}
                                className="px-2 py-1 text-slate-600 hover:text-[#2089C8] hover:bg-sky-50 border border-slate-200 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                                title="Print Delivery Note / Packing Slip (DN - No Prices)"
                              >
                                <Printer className="w-3 h-3 text-[#2089C8]" />
                                <span>DN</span>
                              </button>
                            )}

                            {isDelivered(so.status) && (
                              <button
                                onClick={() => {
                                  setReturnSO(so);
                                  setReturnModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                title="Customer Product Return (Stock IN)"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-teal-600" />
                                <span>Return</span>
                              </button>
                            )}

                            {/* Print / View Official Commercial Invoice Button */}
                            <button
                              onClick={() => handlePrintInvoice(so)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 rounded-lg transition-colors cursor-pointer"
                              title="View & Print Commercial Invoice"
                            >
                              <Printer className="w-3.5 h-3.5 text-emerald-600" />
                            </button>

                            {canEdit && (
                              <button
                                onClick={() => handleEditSO(so)}
                                className="p-1.5 text-slate-500 hover:text-[#2089C8] hover:bg-sky-50 border border-transparent hover:border-sky-200 rounded-lg transition-colors cursor-pointer"
                                title="Edit Sales Order"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {canDelete && (
                              <button
                                onClick={() => handleDeleteSO(so)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                                title="Delete Sales Order"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((so) => (
              <div key={so.id} className="erp-card p-5 flex flex-col justify-between hover:border-[#2089C8]/40 hover:shadow-md transition-all group">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-200">
                      {so.soNumber || so.invoiceNumber}
                    </span>
                    <StatusBadge status={so.status} type="sales" />
                  </div>

                  <h3 className="font-bold text-slate-900 text-base group-hover:text-[#2089C8] transition-colors">
                    {so.customerName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Order Date: {so.orderDate} • {so.itemsCount || so.items?.length || 1} items</p>

                  <div className="mt-4 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium font-sans">Total Amount:</span>
                    <span className="font-bold font-mono text-lg text-emerald-700">${(so.totalAmount || 0).toFixed(2)}</span>
                  </div>
                </div>

                {(canConfirm || canEdit || canDelete) && (
                  <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button
                          onClick={() => handleEditSO(so)}
                          className="px-2.5 py-1 text-slate-600 hover:text-[#2089C8] bg-slate-100 hover:bg-sky-50 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}
                      
                      {(isConfirmed(so.status) || isDelivered(so.status)) && (
                        <button
                          onClick={() => handlePrintDeliveryNote(so)}
                          className="px-2 py-1 text-slate-600 hover:text-[#2089C8] bg-slate-100 hover:bg-sky-50 border border-slate-200 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Print Delivery Note (DN - No Prices)"
                        >
                          <Printer className="w-3 h-3 text-[#2089C8]" /> DN
                        </button>
                      )}

                      <button
                        onClick={() => handlePrintInvoice(so)}
                        className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Print Commercial Invoice"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-600" />
                      </button>

                      {canDelete && (
                        <button
                          onClick={() => handleDeleteSO(so)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {canConfirm && isQuotation(so.status) && (
                      <button
                        onClick={() => handleStatusChange(so.id, 'CONFIRMED')}
                        className="px-3 py-1 bg-sky-50 hover:bg-sky-100 text-[#2089C8] border border-sky-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Confirm SO
                      </button>
                    )}

                    {isConfirmed(so.status) && (
                      <span className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600" /> Stock Dispatch
                      </span>
                    )}

                    {isDelivered(so.status) && (
                      <button
                        onClick={() => {
                          setReturnSO(so);
                          setReturnModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Process Return"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-teal-600" /> Return
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <SalesModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveSO}
        initialSO={selectedSO}
        mode={modalMode}
      />

      {/* Official Printable Invoice Modal */}
      <InvoiceModal
        isOpen={Boolean(printInvoiceSO)}
        onClose={() => setPrintInvoiceSO(null)}
        type="SALES_INVOICE"
        data={printInvoiceSO}
      />

      {/* Official Printable Delivery Note (DN) Modal - NO PRICES */}
      <InvoiceModal
        isOpen={Boolean(printDeliveryNoteSO)}
        onClose={() => setPrintDeliveryNoteSO(null)}
        type="DELIVERY_NOTE"
        data={printDeliveryNoteSO}
      />

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, so: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Sales Order"
        message={`This will permanently delete sales order ${deleteConfirm.so?.soNumber || deleteConfirm.so?.invoiceNumber} for ${deleteConfirm.so?.customerName}. Action cannot be undone.`}
        itemName={deleteConfirm.so ? `${deleteConfirm.so.soNumber || deleteConfirm.so.invoiceNumber} — ${deleteConfirm.so.customerName}` : ''}
        requireConfirmText={deleteConfirm.so?.soNumber || deleteConfirm.so?.invoiceNumber}
        confirmText="Delete Order"
        type="danger"
      />
      {/* Sales Return Modal */}
      <SalesReturnModal
        isOpen={returnModalOpen}
        onClose={() => {
          setReturnModalOpen(false);
          setReturnSO(null);
        }}
        onReturnCreated={fetchOrders}
        initialSale={returnSO}
        salesList={orders}
      />
    </div>
  );
};

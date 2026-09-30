import React, { useState, useEffect, useMemo } from 'react';
import { 
  Tag, CheckCircle2, Truck, DollarSign, Plus, Clock, 
  ArrowUpRight, ShoppingBag, FileSpreadsheet, User, Calendar,
  Sparkles, Check, ChevronRight, Edit2, Trash2
} from 'lucide-react';
import { ControlPanel } from '../../../components/common/ControlPanel';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { salesService } from '../../../services/sales/salesService';
import { SalesOrderModal as SalesModal } from './SalesOrderModal';
import { useAuth } from '../../../context/AuthContext';

export const SalesOrdersPage = () => {
  const { hasPermission } = useAuth();

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

  // Delete Confirm State
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    so: null,
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await salesService.getSalesOrders({
        search: searchQuery,
        status: statusFilter
      });
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [searchQuery, statusFilter]);

  const handleCreateNew = () => {
    if (!canCreate) return;
    setSelectedSO(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEditSO = (so) => {
    if (!canEdit) return;
    setSelectedSO(so);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleSaveSO = async (soData, soId) => {
    if (modalMode === 'edit' && soId) {
      if (!canEdit) return;
      await salesService.updateSalesOrder(soId, soData);
    } else {
      if (!canCreate) return;
      await salesService.createSalesOrder(soData);
    }
    await fetchOrders();
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
    await salesService.deleteSalesOrder(deleteConfirm.so.id);
    setDeleteConfirm({ isOpen: false, so: null });
    await fetchOrders();
  };

  const handleStatusChange = async (soId, nextStatus) => {
    if (!canConfirm && !canPay) return;
    await salesService.updateSalesStatus(soId, nextStatus);
    await fetchOrders();
  };

  const metrics = useMemo(() => {
    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const quotations = orders.filter(o => o.status === 'QUOTATION').length;
    const confirmed = orders.filter(o => o.status === 'SALES_ORDER').length;
    const delivered = orders.filter(o => o.status === 'DELIVERED').length;
    return { totalRevenue, quotations, confirmed, delivered };
  }, [orders]);

  const statusOptions = [
    { label: 'All Orders', value: 'ALL' },
    { label: 'Quotations', value: 'QUOTATION' },
    { label: 'Confirmed SO', value: 'SALES_ORDER' },
    { label: 'Delivered', value: 'DELIVERED' },
  ];

  return (
    <div className="min-h-full pb-16">
      <ControlPanel
        title="Sales & Invoicing Microservice"
        subtitle="Manage customer sales quotations, sales orders, order confirmations, and invoices"
        onCreateNew={canCreate ? handleCreateNew : null}
        createLabel="New Sales Order"
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

      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-6">
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
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto shadow-xs">
            <div className="p-4 bg-sky-50 text-[#2089C8] border border-sky-100 rounded-2xl inline-block mb-3">
              <ShoppingBag className="w-10 h-10" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">No Sales Orders Found</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Create your first customer quotation or sales order.
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
                  {orders.map((so) => (
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
                            <span className="text-[10px] text-slate-400">{so.itemsCount || 1} items</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">{so.orderDate}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">{so.deliveryDate}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-sm">
                        ${(so.totalAmount || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={so.status} />
                      </td>
                      {(canConfirm || canEdit || canDelete) && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canConfirm && so.status === 'QUOTATION' && (
                              <button
                                onClick={() => handleStatusChange(so.id, 'SALES_ORDER')}
                                className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-[#2089C8] border border-sky-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                title="Confirm Sales Order (Stock OUT)"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Confirm Order</span>
                              </button>
                            )}

                            {canConfirm && so.status === 'SALES_ORDER' && (
                              <button
                                onClick={() => handleStatusChange(so.id, 'DELIVERED')}
                                className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                title="Mark as Delivered"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                <span>Mark Delivered</span>
                              </button>
                            )}

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
            {orders.map((so) => (
              <div key={so.id} className="erp-card p-5 flex flex-col justify-between hover:border-[#2089C8]/40 hover:shadow-md transition-all group">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-200">
                      {so.soNumber || so.invoiceNumber}
                    </span>
                    <StatusBadge status={so.status} />
                  </div>

                  <h3 className="font-bold text-slate-900 text-base group-hover:text-[#2089C8] transition-colors">
                    {so.customerName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Order Date: {so.orderDate} • {so.itemsCount || 1} items</p>

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

                    {canConfirm && so.status === 'QUOTATION' && (
                      <button
                        onClick={() => handleStatusChange(so.id, 'SALES_ORDER')}
                        className="px-3 py-1 bg-sky-50 hover:bg-sky-100 text-[#2089C8] border border-sky-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Confirm Order
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
    </div>
  );
};

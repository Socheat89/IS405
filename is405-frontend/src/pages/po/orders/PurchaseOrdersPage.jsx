import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, CheckCircle2, Clock, Trash2, Edit2, Plus, 
  DollarSign, Truck, AlertTriangle, ArrowUpRight, Check, XCircle, FileCheck2, Filter, Printer
} from 'lucide-react';
import { ControlPanel } from '../../../components/common/ControlPanel';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { InvoiceModal } from '../../../components/common/InvoiceModal';
import { purchaseService } from '../../../services/po/purchaseService';
import { PurchaseOrderModal as PurchaseModal } from './PurchaseOrderModal';
import { GrnModal } from './GrnModal';
import { PoApprovalModal } from './PoApprovalModal';
import { useAuth } from '../../../context/AuthContext';

export const PurchaseOrdersPage = () => {
  const { hasPermission } = useAuth();

  const canCreate = hasPermission('purchase-orders.create');
  const canApprove = hasPermission('purchase-orders.approve');
  const canReceive = hasPermission('goods-receipts.create');
  const canEdit = hasPermission('purchase-orders.create') || hasPermission('purchase-orders.approve');
  const canDelete = hasPermission('purchase-orders.cancel') || hasPermission('purchase-orders.create');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('table');
  
  // PO Form Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [selectedPO, setSelectedPO] = useState(null);

  // Approval Modal State
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalPO, setApprovalPO] = useState(null);

  // GRN Goods Receipt Modal State
  const [grnModalOpen, setGrnModalOpen] = useState(false);
  const [grnPO, setGrnPO] = useState(null);

  // Print PO Voucher State
  const [printInvoicePO, setPrintInvoicePO] = useState(null);

  // Delete Confirm State
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    po: null,
  });

  const handlePrintPO = async (po) => {
    try {
      if (!po.items || po.items.length === 0) {
        const full = await purchaseService.getPurchaseOrder(po.id);
        setPrintInvoicePO(full || po);
      } else {
        setPrintInvoicePO(po);
      }
    } catch {
      setPrintInvoicePO(po);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try { 
      const data = await purchaseService.getPurchaseOrders({ search: searchQuery, status: statusFilter }); 
      setOrders(data); 
    }
    catch (err) { 
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
    setSelectedPO(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEditPO = async (po) => {
    if (!canEdit) return;
    try {
      if (!po.items || po.items.length === 0) {
        const fullPO = await purchaseService.getOrder(po.id);
        setSelectedPO(fullPO || po);
      } else {
        setSelectedPO(po);
      }
    } catch (err) {
      console.warn('Could not fetch full PO, using summary:', err);
      setSelectedPO(po);
    }
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleSavePO = async (poData) => {
    if (modalMode === 'edit' && selectedPO) {
      if (!canEdit) return;
      await purchaseService.updatePurchaseOrder(selectedPO.id, poData);
    } else {
      if (!canCreate) return;
      await purchaseService.createPurchaseOrder(poData);
    }
    await fetchOrders();
  };

  const handleApproveClick = (po) => {
    if (!canApprove) return;
    setApprovalPO(po);
    setApprovalModalOpen(true);
  };

  const handleSaveApproval = async (poId, approvalData) => {
    if (!canApprove) return;
    await purchaseService.approveOrder(poId, approvalData);
    await fetchOrders();
  };

  const handleReject = async (poId) => {
    if (!canApprove) return;
    await purchaseService.rejectOrder(poId, 'Rejected by manager');
    await fetchOrders();
  };

  const handleOpenGRN = (po) => {
    if (!canReceive) return;
    setGrnPO(po);
    setGrnModalOpen(true);
  };

  const handleSaveGRN = async (grnData) => {
    if (!canReceive) return;
    await purchaseService.processGoodsReceipt(grnData);
    await fetchOrders();
  };

  const handleDeletePO = (po) => {
    if (!canDelete) return;
    setDeleteConfirm({
      isOpen: true,
      po,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.po || !canDelete) return;
    await purchaseService.deletePurchaseOrder(deleteConfirm.po.id);
    setDeleteConfirm({ isOpen: false, po: null });
    await fetchOrders();
  };

  const metrics = useMemo(() => {
    const totalExpenditure = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const pendingCount = orders.filter(o => o.status === 'PENDING_APPROVAL' || o.status === 'DRAFT').length;
    const approvedCount = orders.filter(o => o.status === 'APPROVED' || o.status === 'PARTIALLY_RECEIVED').length;
    const receivedCount = orders.filter(o => o.status === 'RECEIVED' || o.status === 'CLOSED').length;
    return { totalExpenditure, pendingCount, approvedCount, receivedCount };
  }, [orders]);

  const statusOptions = [
    { label: 'All Orders', value: 'ALL' },
    { label: 'Draft', value: 'DRAFT' },
    { label: 'Pending Approval', value: 'PENDING_APPROVAL' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Partially Received', value: 'PARTIALLY_RECEIVED' },
    { label: 'Received', value: 'RECEIVED' },
    { label: 'Cancelled', value: 'CANCELLED' },
    { label: 'Rejected', value: 'REJECTED' },
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':         
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Draft</span>;
      case 'PENDING_APPROVAL':      
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">Pending Approval</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Approved</span>;
      case 'PARTIALLY_RECEIVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">Partially Received</span>;
      case 'RECEIVED':      
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">Received (Stock IN)</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-800 border border-slate-300">Closed</span>;
      case 'REJECTED':
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">{status}</span>;
      default:              
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  return (
    <div className="min-h-full pb-16">
      <ControlPanel
        title="Purchase Orders (PO) & GRN Receiving"
        subtitle="Manage inbound vendor orders, approval workflows, and Goods Receipt (GRN) Stock IN"
        onCreateNew={canCreate ? handleCreateNew : null}
        createLabel="New Purchase Order"
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
          <div className="erp-card p-4 relative overflow-hidden flex items-center justify-between border-l-4 border-l-emerald-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Expenditure</p>
              <h4 className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                ${metrics.totalExpenditure.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Total Value of POs</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4 relative overflow-hidden flex items-center justify-between border-l-4 border-l-amber-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Approval</p>
              <h4 className="text-2xl font-bold font-mono text-amber-700 mt-1">{metrics.pendingCount}</h4>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">Rule 1: No Stock Change</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4 relative overflow-hidden flex items-center justify-between border-l-4 border-l-blue-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved & Ready</p>
              <h4 className="text-2xl font-bold font-mono text-blue-700 mt-1">{metrics.approvedCount}</h4>
              <p className="text-[11px] text-blue-600 font-medium mt-0.5">Awaiting GRN Receiving</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileCheck2 className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4 relative overflow-hidden flex items-center justify-between border-l-4 border-l-teal-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Goods Received</p>
              <h4 className="text-2xl font-bold font-mono text-teal-700 mt-1">{metrics.receivedCount}</h4>
              <p className="text-[11px] text-teal-600 font-medium mt-0.5">Rule 2: Stock IN Complete</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="py-24 text-center text-slate-500">
            <div className="w-10 h-10 border-4 border-[#2089C8] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-medium text-slate-600">Loading purchase orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-md mx-auto shadow-sm">
            <div className="p-4 bg-sky-50 text-[#2089C8] rounded-2xl inline-block mb-3 border border-sky-100">
              <ShoppingBag className="w-10 h-10" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">No Purchase Orders Found</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              No purchase orders match your filter criteria.
            </p>
            {canCreate && (
              <button
                onClick={handleCreateNew}
                className="btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer shadow-sm"
              >
                + Create First PO
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4">PO Number</th>
                    <th className="py-3.5 px-4">Vendor / Supplier</th>
                    <th className="py-3.5 px-4">Order Date</th>
                    <th className="py-3.5 px-4">Expected Date</th>
                    <th className="py-3.5 px-4">Total Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                    {(canApprove || canReceive || canEdit || canDelete) && (
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((po) => (
                    <tr key={po.id} className="hover:bg-sky-50/40 transition-colors group">
                      <td className="py-3.5 px-4 font-mono font-bold">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] group-hover:border-emerald-300">
                          {po.poNumber}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-sky-50 text-[#155e89] flex items-center justify-center font-bold text-[11px] border border-sky-200">
                            {(po.vendorName || po.supplierName || 'V').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block">{po.vendorName || po.supplierName}</span>
                            <span className="text-[10px] text-slate-400">{po.itemsCount || po.items?.length || 1} items</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">{po.orderDate}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">{po.expectedDate}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-sm">
                        ${(po.totalAmount || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(po.status)}
                      </td>
                      {(canApprove || canReceive || canEdit || canDelete) && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Approval Actions */}
                            {canApprove && (po.status === 'PENDING_APPROVAL' || po.status === 'DRAFT') && (
                              <>
                                <button
                                  onClick={() => handleApproveClick(po)}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                  title="Review and Approve with Selling Price Setup"
                                >
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Approve & Price</span>
                                </button>
                                <button
                                  onClick={() => handleReject(po.id)}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                  title="Reject Purchase Order"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}

                            {/* GRN Goods Receipt Action (Rule 2) */}
                            {canReceive && (po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED') && (
                              <button
                                onClick={() => handleOpenGRN(po)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                title="Process Goods Receipt & Increase Stock"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                <span>Receive Goods (GRN)</span>
                              </button>
                            )}

                            {canEdit && (
                              <button
                                onClick={() => handleEditPO(po)}
                                className="p-1.5 text-slate-500 hover:text-[#2089C8] hover:bg-sky-50 border border-transparent hover:border-sky-200 rounded-lg transition-colors cursor-pointer"
                                title="Edit PO"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* View & Print PO Slip Button */}
                            <button
                              onClick={() => handlePrintPO(po)}
                              className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 border border-transparent hover:border-sky-200 rounded-lg transition-colors cursor-pointer"
                              title="View & Print PO Voucher"
                            >
                              <Printer className="w-3.5 h-3.5 text-[#2089C8]" />
                            </button>

                            {canDelete && (
                              <button
                                onClick={() => handleDeletePO(po)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                                title="Delete PO"
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
            {orders.map((po) => (
              <div key={po.id} className="erp-card p-5 flex flex-col justify-between hover:border-[#2089C8]/40 hover:shadow-md transition-all group">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                      {po.poNumber}
                    </span>
                    {getStatusBadge(po.status)}
                  </div>

                  <h3 className="font-bold text-slate-900 text-base group-hover:text-[#2089C8] transition-colors">
                    {po.vendorName || po.supplierName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Order Date: {po.orderDate} • {po.itemsCount || po.items?.length || 1} items</p>

                  <div className="mt-4 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Total Amount:</span>
                    <span className="font-bold font-mono text-lg text-emerald-700">${(po.totalAmount || 0).toFixed(2)}</span>
                  </div>
                </div>

                {(canApprove || canReceive || canEdit || canDelete) && (
                  <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {canApprove && (po.status === 'PENDING_APPROVAL' || po.status === 'DRAFT') && (
                        <button
                          onClick={() => handleApproveClick(po)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Approve & Price
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => handleEditPO(po)}
                          className="px-2.5 py-1 text-slate-600 hover:text-[#2089C8] bg-slate-100 hover:bg-sky-50 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}
                      <button
                        onClick={() => handlePrintPO(po)}
                        className="p-1 text-slate-500 hover:text-sky-700 hover:bg-sky-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Print PO Voucher"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#2089C8]" />
                      </button>

                      {canDelete && (
                        <button
                          onClick={() => handleDeletePO(po)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {canReceive && (po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED') && (
                      <button
                        onClick={() => handleOpenGRN(po)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      >
                        <Truck className="w-3.5 h-3.5" /> Receive GRN
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <PurchaseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSavePO}
        initialPO={selectedPO}
        mode={modalMode}
      />

      {/* Official Printable PO Voucher Modal */}
      <InvoiceModal
        isOpen={Boolean(printInvoicePO)}
        onClose={() => setPrintInvoicePO(null)}
        type="PURCHASE_ORDER"
        data={printInvoicePO}
      />

      <PoApprovalModal
        isOpen={approvalModalOpen}
        onClose={() => {
          setApprovalModalOpen(false);
          setApprovalPO(null);
        }}
        po={approvalPO}
        onApprove={handleSaveApproval}
      />

      <GrnModal
        isOpen={grnModalOpen}
        onClose={() => setGrnModalOpen(false)}
        po={grnPO}
        onSaveGrn={handleSaveGRN}
      />

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, po: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Purchase Order"
        message={`This will permanently delete purchase order ${deleteConfirm.po?.poNumber} from ${deleteConfirm.po?.vendorName || deleteConfirm.po?.supplierName}. This action cannot be undone.`}
        itemName={deleteConfirm.po ? `${deleteConfirm.po.poNumber} — ${deleteConfirm.po?.vendorName || deleteConfirm.po?.supplierName}` : ''}
        requireConfirmText={deleteConfirm.po?.poNumber}
        confirmText="Delete Order"
        type="danger"
      />
    </div>
  );
};

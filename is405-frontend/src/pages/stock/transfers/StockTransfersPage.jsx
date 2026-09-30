import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRightLeft, Plus, Search, Filter, RefreshCcw, CheckCircle2,
  XCircle, Clock, Building2, Package, Layers, FileText, ChevronRight,
  AlertCircle, Check, Ban
} from 'lucide-react';
import { transferService } from '../../../services/stock/transferService';
import { warehouseService } from '../../../services/stock/warehouseService';
import { TransferModal } from './TransferModal';
import { ControlPanel } from '../../../components/common/ControlPanel';
import { useAuth } from '../../../context/AuthContext';

export const StockTransfersPage = () => {
  const { hasPermission, user } = useAuth();
  const canCreate = user?.isAdmin || hasPermission('transfers.create');

  const [transfers, setTransfers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState({ type: '', text: '' });

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const [transfersData, whData] = await Promise.all([
        transferService.getTransfers({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          warehouseId: warehouseFilter !== 'ALL' ? Number(warehouseFilter) : undefined
        }),
        warehouseService.getWarehouses(false)
      ]);
      setTransfers(transfersData);
      setWarehouses(whData);
    } catch (err) {
      console.error(err);
      setFeedbackMessage({
        type: 'error',
        text: 'Failed to load stock transfers or warehouses from server.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [statusFilter, warehouseFilter]);

  const handleCreateTransfer = async (transferData) => {
    await transferService.createTransfer(transferData);
    setFeedbackMessage({
      type: 'success',
      text: 'Stock transfer initiated successfully!'
    });
    await fetchTransfers();
  };

  const handleCompleteTransfer = async (id, transferNo) => {
    if (!window.confirm(`Are you sure you want to COMPLETE transfer "${transferNo}"? This will immediately move stock from source to destination warehouse.`)) {
      return;
    }

    setActionLoadingId(id);
    try {
      await transferService.completeTransfer(id);
      setFeedbackMessage({
        type: 'success',
        text: `Transfer ${transferNo} completed successfully! Stock levels updated.`
      });
      await fetchTransfers();
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: typeof err === 'string' ? err : err?.message || 'Failed to complete transfer.'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelTransfer = async (id, transferNo) => {
    if (!window.confirm(`Are you sure you want to CANCEL transfer "${transferNo}"?`)) {
      return;
    }

    setActionLoadingId(id);
    try {
      await transferService.cancelTransfer(id);
      setFeedbackMessage({
        type: 'success',
        text: `Transfer ${transferNo} cancelled.`
      });
      await fetchTransfers();
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: typeof err === 'string' ? err : err?.message || 'Failed to cancel transfer.'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const metrics = useMemo(() => {
    const total = transfers.length;
    const pending = transfers.filter(t => t.status === 'PENDING').length;
    const completed = transfers.filter(t => t.status === 'COMPLETED').length;
    const cancelled = transfers.filter(t => t.status === 'CANCELLED').length;
    return { total, pending, completed, cancelled };
  }, [transfers]);

  const filteredTransfers = useMemo(() => {
    if (!searchQuery) return transfers;
    const q = searchQuery.toLowerCase();
    return transfers.filter(t =>
      t.transferNo?.toLowerCase().includes(q) ||
      t.fromWarehouseName?.toLowerCase().includes(q) ||
      t.toWarehouseName?.toLowerCase().includes(q) ||
      t.createdByUsername?.toLowerCase().includes(q) ||
      t.notes?.toLowerCase().includes(q)
    );
  }, [transfers, searchQuery]);

  const statusOptions = [
    { label: 'All Statuses', value: 'ALL' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Cancelled', value: 'CANCELLED' },
  ];

  return (
    <div className="min-h-full pb-16">
      <ControlPanel
        title="Multi-Warehouse Stock Transfers"
        subtitle="Manage and execute inventory transfers between physical warehouse facilities"
        onCreateNew={canCreate ? () => setModalOpen(true) : null}
        createLabel="New Transfer"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOptions={statusOptions}
        onRefresh={fetchTransfers}
        loading={loading}
        actions={
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-500">WH:</span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Facilities</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-6">
        {/* Feedback Alert */}
        {feedbackMessage.text && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between shadow-sm transition-all duration-300 border ${
              feedbackMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-3 text-xs font-semibold">
              {feedbackMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage({ type: '', text: '' })}
              className="text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="p-3 bg-sky-50 text-[#2089C8] rounded-xl border border-sky-100">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{metrics.total}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Transfers</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-700">{metrics.pending}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Transit / Pending</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-700">{metrics.completed}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Transfers</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="p-3 bg-sky-50 text-[#1976ab] rounded-xl border border-sky-100">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{warehouses.length}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Warehouses</div>
            </div>
          </div>
        </div>

        {/* Transfers Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Transfer Number</th>
                  <th className="py-3.5 px-4">From Warehouse (Source)</th>
                  <th className="py-3.5 px-4">To Warehouse (Destination)</th>
                  <th className="py-3.5 px-4">Items / Total Qty</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Initiated Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      <RefreshCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                      Loading stock transfer records...
                    </td>
                  </tr>
                ) : filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No stock transfers found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map((transfer) => {
                    const totalItemsCount = transfer.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
                    const isPending = transfer.status === 'PENDING';
                    const isCompleted = transfer.status === 'COMPLETED';
                    const isCancelled = transfer.status === 'CANCELLED';

                    return (
                      <tr key={transfer.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-purple-900">{transfer.transferNo}</div>
                          {transfer.notes && (
                            <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{transfer.notes}</div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {transfer.fromWarehouseName || 'Source WH'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                            {transfer.toWarehouseName || 'Destination WH'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">
                            {totalItemsCount} units
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {transfer.items?.length || 0} product lines
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              PENDING
                            </span>
                          )}
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              COMPLETED
                            </span>
                          )}
                          {isCancelled && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3" />
                              CANCELLED
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-700">
                            {transfer.transferDate ? new Date(transfer.transferDate).toLocaleDateString() : 'N/A'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            by {transfer.createdByUsername || 'Admin'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {isPending && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleCompleteTransfer(transfer.id, transfer.transferNo)}
                                disabled={actionLoadingId === transfer.id}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                title="Complete Transfer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Complete
                              </button>

                              <button
                                onClick={() => handleCancelTransfer(transfer.id, transfer.transferNo)}
                                disabled={actionLoadingId === transfer.id}
                                className="p-1.5 border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-rose-600 rounded-xl transition-all cursor-pointer"
                                title="Cancel Transfer"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          {!isPending && (
                            <span className="text-[11px] text-slate-400 font-medium">Processed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <TransferModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onTransferCreated={handleCreateTransfer}
      />
    </div>
  );
};

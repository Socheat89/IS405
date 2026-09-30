import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Building2, Package, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { warehouseService } from '../../../services/stock/warehouseService';
import { stockItemService } from '../../../services/stock/stockItemService';

export const TransferModal = ({ isOpen, onClose, onTransferCreated }) => {
  if (!isOpen) return null;

  const [warehouses, setWarehouses] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [transferItems, setTransferItems] = useState([
    { productId: '', quantity: 1 }
  ]);

  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadInitial = async () => {
      setLoadingData(true);
      try {
        const [whs, items] = await Promise.all([
          warehouseService.getWarehouses(true),
          stockItemService.getItems()
        ]);
        setWarehouses(whs);
        setItemsList(items);

        if (whs.length >= 2) {
          setFromWarehouseId(String(whs[0].id));
          setToWarehouseId(String(whs[1].id));
        } else if (whs.length === 1) {
          setFromWarehouseId(String(whs[0].id));
        }

        if (items.length > 0) {
          setTransferItems([{ productId: String(items[0].id), quantity: 1 }]);
        }
      } catch (err) {
        setError('Failed to load warehouses or stock items.');
      } finally {
        setLoadingData(false);
      }
    };
    loadInitial();
  }, [isOpen]);

  const handleAddItemRow = () => {
    const firstId = itemsList[0]?.id ? String(itemsList[0].id) : '';
    setTransferItems([...transferItems, { productId: firstId, quantity: 1 }]);
  };

  const handleRemoveItemRow = (index) => {
    if (transferItems.length <= 1) return;
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...transferItems];
    updated[index][field] = field === 'quantity' ? Math.max(1, Number(value) || 1) : value;
    setTransferItems(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fromWarehouseId || !toWarehouseId) {
      setError('Please select both source and destination warehouses.');
      return;
    }

    if (fromWarehouseId === toWarehouseId) {
      setError('Source and destination warehouses cannot be the same facility.');
      return;
    }

    if (transferItems.length === 0 || transferItems.some(i => !i.productId || i.quantity <= 0)) {
      setError('Please add at least one valid product item and transfer quantity.');
      return;
    }

    setSubmitting(true);
    try {
      await onTransferCreated({
        fromWarehouseId: Number(fromWarehouseId),
        toWarehouseId: Number(toWarehouseId),
        notes,
        items: transferItems.map(i => ({
          productId: Number(i.productId),
          quantity: Number(i.quantity)
        }))
      });
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.message || 'Failed to create stock transfer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 to-indigo-800 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md border border-white/20">
              <ArrowRightLeft className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">New Stock Transfer</h2>
              <p className="text-xs text-purple-100 mt-0.5">
                Transfer inventory between physical warehouse locations (Multi-WH)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loadingData ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Loading warehouse facility data...
            </div>
          ) : (
            <>
              {/* Warehouses Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-purple-600" />
                    From Warehouse (Source)
                  </label>
                  <select
                    value={fromWarehouseId}
                    onChange={(e) => setFromWarehouseId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="" disabled>Select Source Warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    To Warehouse (Destination)
                  </label>
                  <select
                    value={toWarehouseId}
                    onChange={(e) => setToWarehouseId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="" disabled>Select Destination Warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id} disabled={String(w.id) === fromWarehouseId}>
                        {w.name} ({w.code}) {String(w.id) === fromWarehouseId ? '(Source)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-purple-600" />
                    Transfer Items
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-purple-50 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-2.5">
                  {transferItems.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                      <div className="flex-1">
                        <select
                          value={row.productId}
                          onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          {itemsList.map(item => (
                            <option key={item.id} value={item.id}>
                              [{item.sku}] {item.name} — Avail: {item.quantityOnHand ?? item.quantity ?? 0} {item.unit || 'units'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          placeholder="Qty"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      {transferItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Transfer Notes / Reason
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Inter-warehouse rebalancing, seasonal stock transfer..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingData}
              className="px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold tracking-wide transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center gap-2"
            >
              {submitting ? 'Creating Transfer...' : 'Initiate Stock Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

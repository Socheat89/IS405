import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowRightLeft, Building2, Package, AlertCircle, Plus, Trash2, CheckCircle, Info } from 'lucide-react';
import { warehouseService } from '../../../services/stock/warehouseService';
import { stockItemService } from '../../../services/stock/stockItemService';
import { useAuth } from '../../../context/AuthContext';
import { SearchableItemSelect } from '../../../components/common/SearchableItemSelect';

export const TransferModal = ({ isOpen, onClose, onTransferCreated }) => {
  const { user } = useAuth();

  const [warehouses, setWarehouses] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [warehouseStockMap, setWarehouseStockMap] = useState({});
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [transferItems, setTransferItems] = useState([
    { productId: '', quantity: 1 }
  ]);

  const [loadingData, setLoadingData] = useState(true);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Determine allowed source warehouses for the current user
  const allowedSourceWarehouses = useMemo(() => {
    if (!warehouses || warehouses.length === 0) return [];
    if (user?.isAdmin || !user?.warehouseIds || user.warehouseIds.length === 0) {
      return warehouses;
    }
    return warehouses.filter(w => user.warehouseIds.includes(w.id));
  }, [warehouses, user]);

  // Load initial warehouses and catalog items
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const loadInitial = async () => {
      setLoadingData(true);
      setError('');
      try {
        const [whs, items] = await Promise.all([
          warehouseService.getWarehouses(true),
          stockItemService.getItems()
        ]);
        if (!isMounted) return;

        const allWhs = Array.isArray(whs) ? whs : [];
        const allItems = Array.isArray(items) ? items : [];
        setWarehouses(allWhs);
        setItemsList(allItems);

        // Filter user source warehouses
        let allowed = allWhs;
        if (!user?.isAdmin && user?.warehouseIds && user.warehouseIds.length > 0) {
          allowed = allWhs.filter(w => user.warehouseIds.includes(w.id));
        }

        let initialFromId = '';
        if (allowed.length > 0) {
          const defaultWh = allowed.find(w => w.id === user?.defaultWarehouseId) || allowed[0];
          initialFromId = String(defaultWh.id);
          setFromWarehouseId(initialFromId);
        }

        // Destination warehouse (different from source)
        const destWh = allWhs.find(w => String(w.id) !== initialFromId);
        if (destWh) {
          setToWarehouseId(String(destWh.id));
        }

        if (allItems.length > 0) {
          setTransferItems([{ productId: String(allItems[0].id), quantity: 1 }]);
        }
      } catch (err) {
        if (isMounted) setError('Failed to load warehouses or stock items.');
      } finally {
        if (isMounted) setLoadingData(false);
      }
    };

    loadInitial();
    return () => { isMounted = false; };
  }, [isOpen, user]);

  // Whenever source warehouse changes, load warehouse-specific stock counts
  useEffect(() => {
    if (!fromWarehouseId) return;

    let isMounted = true;
    const loadWarehouseStocks = async () => {
      setLoadingStocks(true);
      try {
        const stocks = await warehouseService.getWarehouseStocks({
          warehouseId: Number(fromWarehouseId),
          pageSize: 200
        });

        if (!isMounted) return;
        const stockMap = {};
        if (Array.isArray(stocks)) {
          stocks.forEach(st => {
            const pId = st.productId || st.id;
            stockMap[pId] = Number(st.quantityOnHand) || 0;
          });
        }
        setWarehouseStockMap(stockMap);
      } catch (err) {
        console.warn('Could not fetch warehouse specific stocks:', err);
      } finally {
        if (isMounted) setLoadingStocks(false);
      }
    };

    loadWarehouseStocks();
    return () => { isMounted = false; };
  }, [fromWarehouseId]);

  const fromWarehouseObj = warehouses.find(w => String(w.id) === String(fromWarehouseId));
  const toWarehouseObj = warehouses.find(w => String(w.id) === String(toWarehouseId));

  const getItemAvailableQty = (productId) => {
    if (!productId) return 0;
    return warehouseStockMap[Number(productId)] ?? 0;
  };

  const handleAddItemRow = () => {
    const firstId = itemsList[0]?.id ? String(itemsList[0].id) : '';
    setTransferItems(prev => [...prev, { productId: firstId, quantity: 1 }]);
  };

  const handleRemoveItemRow = (index) => {
    if (transferItems.length <= 1) return;
    setTransferItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setTransferItems(prev => {
      const copy = [...prev];
      if (field === 'quantity') {
        copy[index][field] = value === '' ? '' : Math.max(1, Number(value));
      } else {
        copy[index][field] = value;
      }
      return copy;
    });
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

    if (transferItems.length === 0 || transferItems.some(i => !i.productId || Number(i.quantity) <= 0)) {
      setError('Please add at least one valid product item and transfer quantity.');
      return;
    }

    // Validate quantities against actual stock in source warehouse
    for (let i = 0; i < transferItems.length; i++) {
      const itemRow = transferItems[i];
      const prod = itemsList.find(p => String(p.id) === String(itemRow.productId));
      const avail = getItemAvailableQty(itemRow.productId);
      const requested = Number(itemRow.quantity) || 0;

      if (requested > avail) {
        setError(`Requested quantity (${requested}) for "${prod?.name || 'Item #' + (i + 1)}" exceeds available stock (${avail}) in ${fromWarehouseObj?.name || 'source warehouse'}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await onTransferCreated({
        fromWarehouseId: Number(fromWarehouseId),
        toWarehouseId: Number(toWarehouseId),
        notes: notes?.trim() || null,
        items: transferItems.map(i => ({
          productId: Number(i.productId),
          quantity: Number(i.quantity)
        }))
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || (typeof err === 'string' ? err : err?.message) || 'Failed to create stock transfer.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 to-indigo-800 px-6 py-5 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
              <ArrowRightLeft className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">New Stock Transfer</h2>
              <p className="text-xs text-purple-100 mt-0.5">
                Transfer inventory from your warehouse location
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-xs font-medium shadow-2xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loadingData ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Loading warehouse facility data...
            </div>
          ) : (
            <>
              {/* Warehouses Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-purple-600" />
                    <span>From Warehouse (Your Location)</span>
                  </label>
                  <select
                    value={fromWarehouseId}
                    onChange={(e) => setFromWarehouseId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer"
                  >
                    <option value="" disabled>Select Source Warehouse</option>
                    {allowedSourceWarehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>To Warehouse (Destination)</span>
                  </label>
                  <select
                    value={toWarehouseId}
                    onChange={(e) => setToWarehouseId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer"
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
                    <span>Transfer Items</span>
                    {fromWarehouseObj && (
                      <span className="text-[11px] font-normal text-slate-500 lowercase">
                        (showing stock in <strong className="text-purple-700">{fromWarehouseObj.name}</strong>)
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-purple-50 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {transferItems.map((row, idx) => {
                    const avail = getItemAvailableQty(row.productId);
                    const isExceeded = Number(row.quantity) > avail;

                    return (
                      <div 
                        key={idx} 
                        className={`p-3 bg-slate-50/90 border rounded-2xl transition-all space-y-1.5 ${
                          isExceeded ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200/90'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1">
                            <SearchableItemSelect
                              items={itemsList.map(item => ({
                                ...item,
                                quantityOnHand: getItemAvailableQty(item.id)
                              }))}
                              value={row.productId}
                              onChange={(val) => handleItemChange(idx, 'productId', val)}
                              allowCustom={false}
                              placeholder="Search by SKU or item name..."
                            />
                          </div>

                          <div className="w-28">
                            <input
                              type="number"
                              min="1"
                              max={avail}
                              value={row.quantity === 0 || row.quantity === '' ? '' : row.quantity}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              placeholder="1"
                              className={`w-full px-3 py-2 bg-white border rounded-xl text-xs font-mono font-bold text-center focus:outline-none focus:ring-2 ${
                                isExceeded 
                                  ? 'border-rose-400 text-rose-700 focus:ring-rose-500' 
                                  : 'border-slate-300 text-slate-900 focus:ring-purple-500'
                              }`}
                            />
                          </div>

                          {transferItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Stock Availability Indicator */}
                        <div className="flex items-center justify-between text-[11px] px-1">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">Available in source warehouse:</span>
                            <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                              avail > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {avail} units
                            </span>
                          </div>
                          {isExceeded && (
                            <span className="text-rose-600 font-bold flex items-center gap-1 text-[10px]">
                              <AlertCircle className="w-3 h-3" /> Exceeds stock ({avail})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                  placeholder="e.g. Inter-warehouse rebalancing, restocking branch..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingData}
              className="btn-primary px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              {submitting ? 'Creating Transfer...' : 'Initiate Stock Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

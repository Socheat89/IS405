import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Package, AlertCircle, CheckCircle2, DollarSign, User, Building2 } from 'lucide-react';
import { salesService } from '../../../services/sales/salesService';

export const SalesReturnModal = ({ isOpen, onClose, onReturnCreated, initialSale = null, salesList = [] }) => {
  const [selectedSaleId, setSelectedSaleId] = useState(initialSale?.id ? String(initialSale.id) : '');
  const [currentSale, setCurrentSale] = useState(initialSale);
  const [returnItems, setReturnItems] = useState([]);
  const [reason, setReason] = useState('Customer exchange / defective item');
  const [notes, setNotes] = useState('');
  const [loadingSale, setLoadingSale] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // When selected sale changes, load full order details if needed
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const loadSaleDetails = async () => {
      setError('');
      if (!selectedSaleId) {
        setCurrentSale(null);
        setReturnItems([]);
        return;
      }

      setLoadingSale(true);
      try {
        let saleObj = initialSale && String(initialSale.id) === String(selectedSaleId) ? initialSale : null;
        if (!saleObj || !saleObj.items || saleObj.items.length === 0) {
          saleObj = await salesService.getSalesOrder(selectedSaleId);
        }

        if (!isMounted) return;
        setCurrentSale(saleObj);

        if (saleObj?.items && saleObj.items.length > 0) {
          setReturnItems(saleObj.items.map(it => ({
            productId: it.productId || it.id,
            productName: it.productName || it.itemName || 'Product',
            productSku: it.productSku || it.sku || '',
            originalQty: it.quantity,
            returnQty: 1,
            unitPrice: Number(it.unitPrice) || 0,
            condition: 'Good',
            reason: 'Customer requested exchange / refund',
            selected: true
          })));
        } else {
          setReturnItems([]);
        }
      } catch (err) {
        if (isMounted) setError('Failed to load sales order items.');
      } finally {
        if (isMounted) setLoadingSale(false);
      }
    };

    loadSaleDetails();
    return () => { isMounted = false; };
  }, [selectedSaleId, initialSale, isOpen]);

  const toggleItemSelection = (index) => {
    setReturnItems(prev => {
      const copy = [...prev];
      copy[index].selected = !copy[index].selected;
      return copy;
    });
  };

  const updateItemField = (index, field, value) => {
    setReturnItems(prev => {
      const copy = [...prev];
      if (field === 'returnQty') {
        const val = value === '' ? '' : Math.max(1, Math.min(copy[index].originalQty, Number(value)));
        copy[index].returnQty = val;
      } else {
        copy[index][field] = value;
      }
      return copy;
    });
  };

  const calculateTotalRefund = () => {
    return returnItems
      .filter(i => i.selected)
      .reduce((sum, item) => sum + ((Number(item.returnQty) || 0) * (Number(item.unitPrice) || 0)), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedSaleId || !currentSale) {
      setError('Please select a delivered Sales Order.');
      return;
    }

    const st = (currentSale.status || '').toUpperCase();
    if (st !== 'DELIVERED' && st !== 'COMPLETED') {
      setError(`Cannot process return: Order status is '${st}'. Only DELIVERED orders can be returned because undelivered orders have not deducted warehouse stock.`);
      return;
    }

    const itemsToReturn = returnItems.filter(i => i.selected && (Number(i.returnQty) || 0) > 0);
    if (itemsToReturn.length === 0) {
      setError('Please select at least one item to return into stock.');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for customer return.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        salesOrderId: Number(selectedSaleId),
        warehouseId: currentSale.warehouseId || null,
        reason: reason.trim(),
        notes: notes?.trim() || null,
        items: itemsToReturn.map(i => ({
          productId: Number(i.productId),
          quantity: Number(i.returnQty),
          condition: i.condition,
          reason: i.reason
        }))
      };

      await salesService.createSalesReturn(payload);
      onReturnCreated();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || (typeof err === 'string' ? err : err?.message) || 'Error processing sales return.');
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
        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 px-6 py-5 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">
                Customer Sales Return Request
              </h2>
              <p className="text-xs text-teal-100/90 mt-0.5">
                Initiate customer return request (Stock Keeper confirmation required to restock into warehouse)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-white/10 rounded-xl text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center justify-between shadow-2xs">
              <span className="font-semibold">{error}</span>
              <button 
                type="button" 
                onClick={() => setError('')} 
                className="text-rose-400 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Sales Order Selection */}
          <div className="p-4 bg-teal-50/50 border border-teal-100 rounded-2xl space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-teal-600" />
                <span>Select Original Sales Order / Invoice</span>
              </label>
              {initialSale ? (
                <div className="p-3 bg-white border border-teal-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-teal-900 block">
                      {initialSale.invoiceNumber || initialSale.soNumber}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Customer: <strong>{initialSale.customerName}</strong>
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                    {initialSale.status}
                  </span>
                </div>
              ) : (
                <select
                  value={selectedSaleId}
                  onChange={(e) => setSelectedSaleId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="" disabled>Select Confirmed Order...</option>
                  {salesList.map(s => (
                    <option key={s.id} value={s.id}>
                      [{s.soNumber || s.invoiceNumber}] — {s.customerName} (${(s.totalAmount || 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {currentSale && (
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-teal-100 text-slate-600">
                <div>Customer: <strong className="text-slate-800">{currentSale.customerName}</strong></div>
                <div>Restock Warehouse: <strong className="text-slate-800">{currentSale.warehouseName || 'Main Warehouse'}</strong></div>
              </div>
            )}
          </div>

          {/* Return Line Items */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Items to Return / Restock
            </label>

            {loadingSale ? (
              <div className="py-8 text-center text-slate-400 text-xs">Loading sales order line items...</div>
            ) : returnItems.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
                Please select a sales order above to view purchasable items.
              </div>
            ) : (
              <div className="space-y-2.5">
                {returnItems.map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-2xl border transition-all space-y-2 ${
                      item.selected ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-200' : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-900 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleItemSelection(idx)}
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span>{item.productName}</span>
                        {item.productSku && <span className="font-mono text-[10px] text-slate-400">({item.productSku})</span>}
                      </label>

                      <span className="text-xs font-mono font-bold text-slate-700">
                        ${(item.unitPrice || 0).toFixed(2)} / unit
                      </span>
                    </div>

                    {item.selected && (
                      <div className="grid grid-cols-12 gap-2 pt-2 border-t border-emerald-100 items-center text-xs">
                        <div className="col-span-5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                            Return Qty (Max: {item.originalQty})
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={item.originalQty}
                            value={item.returnQty === 0 || item.returnQty === '' ? '' : item.returnQty}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateItemField(idx, 'returnQty', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-bold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>

                        <div className="col-span-7">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                            Item Condition
                          </label>
                          <select
                            value={item.condition}
                            onChange={(e) => updateItemField(idx, 'condition', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          >
                            <option value="Good">Good Condition (Resellable Stock IN)</option>
                            <option value="Defective">Defective / Damaged (Return to Vendor)</option>
                            <option value="Opened">Opened Box</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reason & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Return Reason <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Defective unit, customer changed mind"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Additional Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional customer feedback or serial #"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Total Refund / Restock Summary */}
          <div className="p-4 bg-teal-50/80 border border-teal-200 rounded-2xl flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-teal-950">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>Estimated Refund / Credit Value:</span>
              </div>
              <p className="text-[11px] text-teal-700 mt-0.5">
                Items will enter warehouse inventory once confirmed by Stock Keeper.
              </p>
            </div>
            <span className="text-xl font-bold font-mono text-teal-800">
              ${calculateTotalRefund().toFixed(2)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || returnItems.length === 0}
              className="px-5 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              {submitting ? 'Submitting Request...' : 'Submit Return Request (Awaiting Stock)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

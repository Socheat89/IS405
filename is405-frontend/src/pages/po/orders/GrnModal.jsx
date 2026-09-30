import React, { useState, useEffect } from 'react';
import { X, Truck, AlertTriangle, CheckCircle2, PackageCheck, Layers, FileText } from 'lucide-react';

export const GrnModal = ({ isOpen, onClose, po, onSaveGrn }) => {
  if (!isOpen || !po) return null;

  const [receiptItems, setReceiptItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    setNotes('');
    if (po && po.items) {
      setReceiptItems(
        po.items.map((item) => {
          const ordered = item.quantity || item.orderedQuantity || 0;
          const prevReceived = item.receivedQuantity || 0;
          const remaining = Math.max(0, ordered - prevReceived);
          return {
            productId: item.productId || item.id,
            productName: item.productName || item.itemName || 'Product',
            orderedQuantity: ordered,
            previouslyReceived: prevReceived,
            remainingQuantity: remaining,
            receivedQuantity: remaining, // default to remaining
            damagedQuantity: 0,
            remarks: '',
          };
        })
      );
    }
  }, [po, isOpen]);

  const updateItemField = (index, field, value) => {
    const updated = [...receiptItems];
    const numVal = Math.max(0, Number(value) || 0);
    updated[index][field] = field === 'remarks' ? value : numVal;
    setReceiptItems(updated);
  };

  const calculateTotals = () => {
    return receiptItems.reduce(
      (acc, item) => {
        const rec = Number(item.receivedQuantity) || 0;
        const dam = Number(item.damagedQuantity) || 0;
        const accQty = Math.max(0, rec - dam);
        acc.totalReceived += rec;
        acc.totalDamaged += dam;
        acc.totalAccepted += accQty;
        return acc;
      },
      { totalReceived: 0, totalDamaged: 0, totalAccepted: 0 }
    );
  };

  const totals = calculateTotals();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const invalidItem = receiptItems.find(
      (i) => i.receivedQuantity < 0 || i.damagedQuantity < 0
    );
    if (invalidItem) {
      setError('Quantities cannot be negative.');
      return;
    }

    const totalRec = totals.totalReceived;
    if (totalRec <= 0) {
      setError('Please enter at least 1 received quantity.');
      return;
    }

    const overReceived = receiptItems.find(
      (i) => i.damagedQuantity > i.receivedQuantity
    );
    if (overReceived) {
      setError(`Damaged quantity cannot exceed received quantity for ${overReceived.productName}.`);
      return;
    }

    setSubmitting(true);
    try {
      const grnData = {
        purchaseOrderId: po.id,
        warehouseId: po.warehouseId || 1,
        notes,
        items: receiptItems.map((i) => ({
          productId: i.productId,
          receivedQuantity: Number(i.receivedQuantity),
          damagedQuantity: Number(i.damagedQuantity),
          remarks: i.remarks,
        })),
      };

      await onSaveGrn(grnData);
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.message || 'Error processing goods receipt.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md border border-white/20">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Goods Receiving / GRN</h2>
                <span className="px-2 py-0.5 rounded-md bg-white/20 text-white font-mono text-xs font-semibold">
                  {po.poNumber}
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Record received stock into warehouse • Auto triggers <span className="font-bold underline decoration-emerald-300">Stock IN</span> (Rule 2)
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError('')}
                className="text-rose-400 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Supplier Meta Card */}
          <div className="bg-slate-50/90 rounded-2xl border border-slate-200/80 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Supplier / Vendor:</span>
              <span className="font-bold text-slate-800 block truncate">{po.vendorName || po.supplierName || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Order Status:</span>
              <span className="font-bold text-purple-700 block">{po.status}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Warehouse:</span>
              <span className="font-bold text-slate-800 block">{po.warehouseName || 'Main Warehouse'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Total Items:</span>
              <span className="font-bold text-slate-800 block">{po.items?.length || 0} line items</span>
            </div>
          </div>

          {/* Items Receipt Table */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Items Receiving Breakdown</span>
              <span className="text-[11px] text-slate-400 font-normal lowercase">Accepted = Received - Damaged</span>
            </label>

            <div className="space-y-3">
              {receiptItems.map((item, idx) => {
                const accepted = Math.max(0, (Number(item.receivedQuantity) || 0) - (Number(item.damagedQuantity) || 0));
                return (
                  <div key={idx} className="p-4 bg-slate-50/70 hover:bg-emerald-50/30 rounded-2xl border border-slate-200/80 transition-all space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PackageCheck className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-slate-900 text-xs">{item.productName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-slate-500">Ordered: <strong className="font-mono text-slate-800">{item.orderedQuantity}</strong></span>
                        <span className="text-slate-500">Prev Received: <strong className="font-mono text-slate-800">{item.previouslyReceived}</strong></span>
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold border border-emerald-200">
                          Remaining: {item.remainingQuantity}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center pt-1 border-t border-slate-200/60">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Received Qty
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={item.receivedQuantity}
                          onChange={(e) => updateItemField(idx, 'receivedQuantity', e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-rose-600 uppercase mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-500" /> Damaged Qty
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={item.damagedQuantity}
                          onChange={(e) => updateItemField(idx, 'damagedQuantity', e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-rose-200 rounded-xl text-xs font-mono font-bold text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Accepted (Stock IN)
                        </label>
                        <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-mono font-bold text-emerald-800">
                          +{accepted} units
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Remarks
                        </label>
                        <input
                          type="text"
                          placeholder="Condition / Notes..."
                          value={item.remarks}
                          onChange={(e) => updateItemField(idx, 'remarks', e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>GRN Delivery Notes</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received via DHL Express Airway bill #99238..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          {/* Summary Box */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-4 rounded-2xl border border-emerald-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-emerald-900">Goods Receipt Summary</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Receiving total <strong className="font-mono">{totals.totalReceived}</strong> units ({totals.totalDamaged} damaged).
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="text-right">
                <span className="text-slate-500 text-[10px] block uppercase font-sans font-bold">Total Stock IN:</span>
                <span className="text-base font-bold text-emerald-700">+{totals.totalAccepted} units</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing GRN...</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4" />
                  <span>Confirm Goods Receipt (Stock IN)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

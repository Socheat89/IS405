import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, X, AlertCircle, ShoppingBag, DollarSign, 
  TrendingUp, Building, Calendar, Package, ArrowRight, ShieldCheck 
} from 'lucide-react';
import { stockItemService } from '../../../services/stock/stockItemService';

export const PoApprovalModal = ({ isOpen, onClose, onApprove, po }) => {
  const [itemPrices, setItemPrices] = useState([]);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !po) return;
    let isMounted = true;
    const initItems = async () => {
      setLoading(true);
      setError('');
      try {
        let catalog = [];
        try {
          catalog = await stockItemService.getItems();
        } catch {
          catalog = [];
        }

        const lines = (po.items || []).map(item => {
          const matchedStock = catalog.find(c => 
            c.id === (item.productId || item.itemId) || 
            c.sku === item.productSku || 
            c.name === item.productName
          );
          
          const unitCost = Number(item.unitCost) || 0;
          // Pre-populate with current stock selling price if set, or suggest a 30% margin
          const currentSelling = Number(matchedStock?.sellingPrice) || Number(matchedStock?.unitPrice) || 0;
          const defaultSelling = currentSelling > 0 ? currentSelling : (unitCost > 0 ? Number((unitCost * 1.3).toFixed(2)) : 0);

          return {
            productId: item.productId || matchedStock?.id || 0,
            productSku: item.productSku || matchedStock?.sku || '',
            productName: item.productName || item.itemName || matchedStock?.name || 'Item',
            quantity: item.quantity || 1,
            unitCost: unitCost,
            sellingPrice: defaultSelling,
            currentSellingPrice: currentSelling,
            stockOnHand: matchedStock?.quantityOnHand || 0
          };
        });

        if (isMounted) {
          setItemPrices(lines);
        }
      } catch (err) {
        console.error('Error preparing approval items:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initItems();
  }, [po]);

  const handlePriceChange = (index, value) => {
    setItemPrices(prev => {
      const copy = [...prev];
      copy[index].sellingPrice = value === '' ? '' : Math.max(0, Number(value));
      return copy;
    });
  };

  const calculateMargin = (unitCost, sellingPrice) => {
    if (!sellingPrice || sellingPrice <= 0 || !unitCost) return 0;
    const profit = sellingPrice - unitCost;
    return ((profit / sellingPrice) * 100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        itemPrices: itemPrices.map(i => ({
          productId: i.productId,
          sellingPrice: Number(i.sellingPrice) || 0
        })),
        notes: approvalNotes?.trim() || null
      };
      await onApprove(po.id, payload);
      onClose();
    } catch (err) {
      console.error('Approval failed:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to approve purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !po) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 px-6 py-5 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white">
                  Manager PO Approval & Price Setting
                </h2>
                <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-md uppercase tracking-wider font-mono">
                  {po.poNumber || po.orderNumber || (po.id ? 'PO-#' + po.id : '')}
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Review vendor purchase costs & establish official selling prices for inventory
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
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

          {/* PO Quick Summary Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/80">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Supplier</span>
              <span className="text-xs font-bold text-slate-900 block truncate">{po.vendorName || po.supplierName || 'Vendor'}</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Total PO Cost</span>
              <span className="text-xs font-mono font-extrabold text-slate-900 block">
                ${(po.totalAmount || 0).toFixed(2)}
              </span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Order Status</span>
              <span className="text-xs font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md inline-block">
                {po.status}
              </span>
            </div>
          </div>

          {/* Manager Price Setup Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Set Product Selling Prices</span>
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Applied to Inventory upon Approval
              </span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Loading line items...
              </div>
            ) : itemPrices.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                No items found in this purchase order.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {itemPrices.map((item, idx) => {
                  const margin = calculateMargin(item.unitCost, item.sellingPrice);
                  const isProfitable = item.sellingPrice >= item.unitCost;

                  return (
                    <div 
                      key={idx}
                      className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-emerald-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      {/* Item Info */}
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs text-slate-900 truncate">
                            {item.productName}
                          </h4>
                          {item.productSku && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-mono text-[10px] rounded font-semibold shrink-0">
                              {item.productSku}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span>Qty: <strong className="text-slate-700 font-mono">{item.quantity}</strong></span>
                          <span>•</span>
                          <span>Purchase Cost: <strong className="text-slate-800 font-mono">${item.unitCost.toFixed(2)}</strong></span>
                          {item.currentSellingPrice > 0 && (
                            <>
                              <span>•</span>
                              <span>Current Price: <strong className="text-slate-600 font-mono">${item.currentSellingPrice.toFixed(2)}</strong></span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Selling Price Input & Profit Margin */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-36">
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                            Approved Selling Price
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-slate-400 text-xs font-bold">$</span>
                            <input 
                              type="number" 
                              step="0.01" 
                              min="0" 
                              required 
                              value={item.sellingPrice === 0 || item.sellingPrice === '' ? '' : item.sellingPrice}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handlePriceChange(idx, e.target.value)}
                              placeholder="0.00"
                              className="w-full pl-6 pr-2 py-1.5 bg-emerald-50/40 border border-emerald-300 rounded-xl text-xs font-mono font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" 
                            />
                          </div>
                        </div>

                        {/* Margin Badge */}
                        <div className="w-24 text-right pt-3">
                          <span className={`inline-block px-2 py-1 rounded-lg text-[10px] font-mono font-bold ${
                            isProfitable 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {margin > 0 ? `+${margin.toFixed(1)}%` : `${margin.toFixed(1)}%`} Margin
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manager Approval Notes */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Approval Notes / Instructions (Optional)
            </label>
            <textarea
              rows={2}
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="e.g. Approved with updated retail pricing for the upcoming promotion..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Approving...' : 'Confirm & Approve PO'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

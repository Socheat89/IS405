import React, { useState, useEffect } from 'react';
import { X, Package, Plus, Minus, RefreshCcw, Barcode, DollarSign, Layers, MapPin, AlertCircle, Sparkles, Edit2 } from 'lucide-react';

export const StockItemModal = ({ isOpen, onClose, onSave, mode = 'create', initialItem = null }) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState({
    sku: initialItem?.sku || '',
    name: initialItem?.name || '',
    categoryName: initialItem?.categoryName || 'Electronics',
    quantityOnHand: initialItem?.quantityOnHand || 10,
    reorderLevel: initialItem?.reorderLevel || 5,
    unitPrice: initialItem?.unitPrice || 99.00,
    location: initialItem?.location || 'Warehouse Main (A1)',
    barcode: initialItem?.barcode || ''
  });

  const [adjustmentType, setAdjustmentType] = useState('add'); // 'add' | 'deduct'
  const [adjustmentQty, setAdjustmentQty] = useState(10);
  const [adjustmentReason, setAdjustmentReason] = useState('Inventory Restock');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    if (initialItem && (mode === 'edit' || mode === 'adjust')) {
      setFormData({
        sku: initialItem.sku || '',
        name: initialItem.name || '',
        categoryName: initialItem.categoryName || 'Electronics',
        quantityOnHand: initialItem.quantityOnHand !== undefined ? initialItem.quantityOnHand : 10,
        reorderLevel: initialItem.reorderLevel !== undefined ? initialItem.reorderLevel : 5,
        unitPrice: initialItem.unitPrice !== undefined ? initialItem.unitPrice : 99.00,
        location: initialItem.location || 'Warehouse Main (A1)',
        barcode: initialItem.barcode || ''
      });
      setAdjustmentQty(10);
      setAdjustmentType('add');
      setAdjustmentReason('Inventory Restock');
    } else {
      setFormData({
        sku: '',
        name: '',
        categoryName: 'Electronics',
        quantityOnHand: 10,
        reorderLevel: 5,
        unitPrice: 99.00,
        location: 'Warehouse Main (A1)',
        barcode: ''
      });
    }
  }, [initialItem, mode, isOpen]);

  const calculateProjectedStock = () => {
    const current = initialItem?.quantityOnHand || 0;
    const change = adjustmentType === 'add' ? Math.abs(adjustmentQty) : -Math.abs(adjustmentQty);
    return Math.max(0, current + change);
  };

  const handleGenerateSKU = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const prefix = formData.categoryName ? formData.categoryName.substring(0, 3).toUpperCase() : 'STK';
    setFormData(prev => ({
      ...prev,
      sku: `${prefix}-${rand}`,
      barcode: `885${rand}9921`
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (mode === 'adjust') {
        const finalQty = adjustmentType === 'add' ? Math.abs(adjustmentQty) : -Math.abs(adjustmentQty);
        await onSave(initialItem.id, finalQty, adjustmentReason);
      } else if (mode === 'edit') {
        await onSave(formData, initialItem.id);
      } else {
        await onSave(formData);
      }
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.message || 'Error processing stock update');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1976ab] to-[#2089C8] px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md border border-white/20">
              {mode === 'adjust' ? (
                <RefreshCcw className="w-5 h-5 text-white" />
              ) : mode === 'edit' ? (
                <Edit2 className="w-5 h-5 text-white" />
              ) : (
                <Package className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {mode === 'adjust' 
                  ? 'Adjust Stock Quantity' 
                  : mode === 'edit' 
                  ? `Edit Product (${initialItem?.sku})` 
                  : 'New Product'}
              </h2>
              <p className="text-xs text-sky-100 mt-0.5">
                {mode === 'adjust' 
                  ? `${initialItem?.name} • Current Quantity: ${initialItem?.quantityOnHand}` 
                  : mode === 'edit' 
                  ? 'Update price, category, location, and SKU' 
                  : 'Fill product details to register in system'}
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
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

          {mode === 'adjust' ? (
            <div className="space-y-4">
              {/* Stock Preview Pill */}
              <div className="p-4 bg-sky-50/70 border border-sky-200/80 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#1976ab] block">Current Stock:</span>
                  <span className="text-2xl font-bold font-mono text-slate-800">{initialItem?.quantityOnHand}</span>
                  <span className="text-xs text-slate-500 ml-1.5">units</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-500 block">Projected Stock:</span>
                  <span className="text-2xl font-bold font-mono text-emerald-700">{calculateProjectedStock()}</span>
                  <span className="text-xs text-slate-500 ml-1.5">units</span>
                </div>
              </div>

              {/* Action Type Toggle */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('add')}
                    className={`p-3 rounded-2xl border font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      adjustmentType === 'add'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Plus className="w-4 h-4 text-emerald-600" />
                    <span>Restock (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustmentType('deduct')}
                    className={`p-3 rounded-2xl border font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      adjustmentType === 'deduct'
                        ? 'bg-rose-500/10 border-rose-500 text-rose-800 ring-2 ring-rose-500/20 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Minus className="w-4 h-4 text-rose-600" />
                    <span>Write-off (-)</span>
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Quantity to {adjustmentType === 'add' ? 'Add' : 'Deduct'}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={adjustmentQty}
                  onChange={(e) => setAdjustmentQty(Math.max(1, Number(e.target.value)))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Adjustment Reason
                </label>
                <input
                  type="text"
                  required
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="e.g. Monthly inventory count, damaged goods, or direct purchase"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                />
              </div>
            </div>
          ) : (
            /* Create / Edit Product Item */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">SKU Code</label>
                    <button
                      type="button"
                      onClick={handleGenerateSKU}
                      className="text-[10px] text-[#2089C8] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" /> Auto
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    placeholder="ELEC-1001"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={formData.categoryName}
                    onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Computers">Computers & Laptops</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Office">Office Equipment</option>
                    <option value="Furniture">Furniture & Decor</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Dell UltraSharp 27 4K Monitor"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Quantity (Qty)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.quantityOnHand}
                    onChange={(e) => setFormData({ ...formData, quantityOnHand: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Reorder Alert Level
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Unit Price ($)
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.unitPrice}
                    onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Warehouse Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Warehouse Main (Shelf B-02)"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Barcode
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="88512349001"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <span>
                  {mode === 'adjust' 
                    ? 'Confirm Adjustment' 
                    : mode === 'edit' 
                    ? 'Save Changes' 
                    : 'Save Product'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

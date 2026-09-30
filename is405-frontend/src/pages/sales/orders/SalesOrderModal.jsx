import React, { useState, useEffect } from 'react';
import { X, Tag, Plus, Trash2, Calculator, Calendar, User, Sparkles, DollarSign, Edit2 } from 'lucide-react';

export const SalesOrderModal = ({ isOpen, onClose, onSave, initialSO = null, mode = 'create' }) => {
  if (!isOpen) return null;

  const [customerName, setCustomerName] = useState(initialSO?.customerName || 'Angkor Tech Solutions');
  const [deliveryDate, setDeliveryDate] = useState(initialSO?.deliveryDate || '2026-10-15');
  const [items, setItems] = useState(
    initialSO?.items && initialSO.items.length > 0
      ? initialSO.items
      : [{ itemName: 'MacBook Pro M3 Max 16"', quantity: 2, unitPrice: 2499.00 }]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    if (initialSO && mode === 'edit') {
      setCustomerName(initialSO.customerName || '');
      setDeliveryDate(initialSO.deliveryDate || '');
      setItems(initialSO.items && initialSO.items.length > 0 ? initialSO.items : [{ itemName: '', quantity: 1, unitPrice: 0 }]);
    } else {
      setCustomerName('Angkor Tech Solutions');
      setDeliveryDate('2026-10-15');
      setItems([{ itemName: 'MacBook Pro M3 Max 16"', quantity: 2, unitPrice: 2499.00 }]);
    }
  }, [initialSO, mode, isOpen]);

  const addItemRow = () => {
    setItems([...items, { itemName: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItemRow = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = field === 'itemName' ? value : Number(value);
    setItems(updated);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!customerName.trim() || items.length === 0) {
      setError('Please enter customer name and at least one order item.');
      return;
    }
    setSubmitting(true);
    try {
      await onSave({
        customerName,
        deliveryDate,
        totalAmount: calculateSubtotal(),
        status: initialSO?.status || 'QUOTATION',
        items
      }, initialSO?.id);
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.message || 'Error saving sales order');
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
        <div className="bg-gradient-to-r from-[#1976ab] to-[#2089C8] px-6 py-5 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
              {mode === 'edit' ? <Edit2 className="w-5 h-5 text-white" /> : <Tag className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">
                {mode === 'edit' ? `Edit Sales Order (${initialSO?.soNumber})` : 'New Sales Order'}
              </h2>
              <p className="text-xs text-sky-100/90 mt-0.5">
                {mode === 'edit' ? 'Update customer information and line items' : 'Create a quotation or sales order for customer'}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Customer Name</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Angkor Tech Co., Ltd"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Expected Delivery Date</span>
              </label>
              <input
                type="date"
                required
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
              />
            </div>
          </div>

          {/* Line Items Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Order Lines
              </label>
              <button
                type="button"
                onClick={addItemRow}
                className="px-3 py-1 bg-sky-50 hover:bg-sky-100 text-[#2089C8] border border-sky-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6">
                    <input
                      type="text"
                      required
                      value={item.itemName}
                      onChange={(e) => updateItemRow(index, 'itemName', e.target.value)}
                      placeholder="Item name / description..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30"
                    />
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      required
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItemRow(index, 'quantity', e.target.value)}
                      placeholder="Qty"
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-center font-bold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30"
                    />
                  </div>

                  <div className="col-span-3">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">$</span>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => updateItemRow(index, 'unitPrice', e.target.value)}
                        placeholder="Price"
                        className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30"
                      />
                    </div>
                  </div>

                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeItemRow(index)}
                      disabled={items.length === 1}
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Summary Box */}
          <div className="p-4 bg-sky-50/70 border border-sky-200/80 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <Calculator className="w-4 h-4 text-[#2089C8]" />
              <span>Total Estimated Amount:</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold font-mono text-emerald-700">
                ${calculateSubtotal().toFixed(2)}
              </span>
            </div>
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
              disabled={submitting}
              className="btn-primary px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <span>{mode === 'edit' ? 'Save Changes' : 'Create Quotation'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

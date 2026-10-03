import React, { useState, useEffect } from 'react';
import { X, Building2, MapPin, Phone, AlertCircle } from 'lucide-react';

export const WarehouseModal = ({ isOpen, onClose, warehouse, onSaveWarehouse }) => {
  const isEditing = Boolean(warehouse?.id);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    location: '',
    contactPhone: '',
    isActive: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (warehouse) {
      setFormData({
        code: warehouse.code || '',
        name: warehouse.name || '',
        location: warehouse.location || '',
        contactPhone: warehouse.contactPhone || '',
        isActive: warehouse.isActive ?? true
      });
    } else {
      setFormData({
        code: '',
        name: '',
        location: '',
        contactPhone: '',
        isActive: true
      });
    }
    setError('');
  }, [warehouse, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.code.trim() || !formData.name.trim()) {
      setError('Warehouse code and name are required.');
      return;
    }

    setSubmitting(true);
    try {
      await onSaveWarehouse(formData, warehouse?.id);
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.message || 'Failed to save warehouse.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-700 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md border border-white/20">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {isEditing ? `Edit Warehouse: ${warehouse.code}` : 'Add New Warehouse Facility'}
              </h2>
              <p className="text-xs text-amber-100 mt-0.5">
                Manage storage location for multi-warehouse inventory
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                disabled={isEditing}
                placeholder="e.g. WH-NORTH"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Facility Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. North Distribution Center"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Physical Location / Address
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. Building 12, Sen Sok Industrial Zone, Phnom Penh"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              Contact Phone
            </label>
            <input
              type="text"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              placeholder="e.g. +855 12 345 678"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="whActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-amber-600 rounded-md focus:ring-amber-500 border-slate-300"
            />
            <label htmlFor="whActive" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Facility is active and available for stock allocation
            </label>
          </div>

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
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold tracking-wide transition-all shadow-md hover:shadow-lg cursor-pointer"
            >
              {submitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Warehouse')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

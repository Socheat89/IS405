import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, Search, MapPin, Phone, CheckCircle2,
  XCircle, Edit2, Package, RefreshCcw, AlertCircle
} from 'lucide-react';
import { warehouseService } from '../../../services/stock/warehouseService';
import { WarehouseModal } from './WarehouseModal';
import { ControlPanel } from '../../../components/common/ControlPanel';
import { useAuth } from '../../../context/AuthContext';

export const WarehousesPage = () => {
  const { hasPermission, user } = useAuth();
  const canCreate = user?.isAdmin || hasPermission('warehouses.create');

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const data = await warehouseService.getWarehouses(false);
      setWarehouses(data);
    } catch (err) {
      setFeedback({ type: 'error', text: 'Failed to load warehouses from backend.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleSaveWarehouse = async (formData, id) => {
    if (id) {
      await warehouseService.updateWarehouse(id, formData);
      setFeedback({ type: 'success', text: `Warehouse ${formData.name} updated.` });
    } else {
      await warehouseService.createWarehouse(formData);
      setFeedback({ type: 'success', text: `Warehouse ${formData.name} created.` });
    }
    await fetchWarehouses();
  };

  const filteredWarehouses = warehouses.filter(w => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      w.code?.toLowerCase().includes(q) ||
      w.name?.toLowerCase().includes(q) ||
      w.location?.toLowerCase().includes(q) ||
      w.contactPhone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-full pb-16">
      <ControlPanel
        title="Multi-Warehouse Facilities"
        subtitle="Manage physical storage locations, distribution hubs, and warehouse network"
        onCreateNew={canCreate ? () => { setSelectedWarehouse(null); setModalOpen(true); } : null}
        createLabel="Add Warehouse"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={fetchWarehouses}
        loading={loading}
      />

      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-6">
        {feedback.text && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between shadow-sm border ${
              feedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              <span>{feedback.text}</span>
            </div>
            <button
              onClick={() => setFeedback({ type: '', text: '' })}
              className="text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Warehouses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full py-12 text-center text-slate-400">
              <RefreshCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
              Loading warehouse network...
            </div>
          ) : filteredWarehouses.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No warehouse facilities found.
            </div>
          ) : (
            filteredWarehouses.map((wh) => (
              <div
                key={wh.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-50 rounded-xl text-amber-700 border border-amber-100">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">{wh.name}</h3>
                        <span className="font-mono text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                          {wh.code}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        wh.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {wh.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="text-slate-700 font-medium">{wh.location || 'No address specified'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-700 font-medium">{wh.contactPhone || 'No contact phone'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400">
                    ID #{wh.id}
                  </div>

                  {canCreate && (
                    <button
                      onClick={() => { setSelectedWarehouse(wh); setModalOpen(true); }}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      Edit Facility
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <WarehouseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        warehouse={selectedWarehouse}
        onSaveWarehouse={handleSaveWarehouse}
      />
    </div>
  );
};

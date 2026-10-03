import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, RefreshCcw, Plus, MapPin, Tag, BarChart3, 
  AlertTriangle, DollarSign, Layers, ArrowUpDown, ChevronRight,
  Boxes, ShieldAlert, Sparkles, Filter, Edit2, Trash2, History,
  Building2
} from 'lucide-react';
import { ControlPanel } from '../../../components/common/ControlPanel';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { stockItemService as stockService } from '../../../services/stock/stockItemService';
import { warehouseService } from '../../../services/stock/warehouseService';
import { StockItemModal as StockModal } from './StockItemModal';
import { ItemLedgerModal } from './ItemLedgerModal';
import { useAuth } from '../../../context/AuthContext';

import { useToast } from '../../../context/ToastContext';

export const StockItemsPage = () => {
  const { hasPermission, user } = useAuth();
  const toast = useToast();

  const canCreate = hasPermission('stock-items.create');
  const canEdit = hasPermission('stock-items.edit');
  const canDelete = hasPermission('stock-items.delete');
  const canAdjust = hasPermission('stock-adjustments.create') || hasPermission('stock-items.edit');

  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit' | 'adjust'
  const [selectedItem, setSelectedItem] = useState(null);
  const [ledgerItem, setLedgerItem] = useState(null);

  // Delete Confirm State
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    item: null,
  });

  // Load accessible warehouses and determine the user's Main/Default warehouse
  useEffect(() => {
    let isMounted = true;
    const loadWarehouses = async () => {
      try {
        const whList = await warehouseService.getWarehouses(true);
        if (!isMounted) return;

        const enriched = whList.map(w => {
          const isUserDef = user?.assignedWarehouses?.find(uw => uw.id === w.id)?.isDefault 
            || user?.defaultWarehouseId === w.id 
            || w.code === 'WH-MAIN';
          return { ...w, isDefault: Boolean(isUserDef) };
        });

        setWarehouses(enriched);
        const defWh = enriched.find(w => w.isDefault) || enriched[0];
        if (defWh && !selectedWarehouseId) {
          setSelectedWarehouseId(defWh.id);
        }
      } catch (err) {
        console.warn('Could not load warehouses:', err);
      }
    };
    loadWarehouses();
    return () => { isMounted = false; };
  }, [user]);

  const fetchItems = async (whId = selectedWarehouseId) => {
    setLoading(true);
    try {
      const data = await stockService.getItems({
        search: searchQuery,
        status: statusFilter,
        warehouseId: whId || undefined
      });
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems(selectedWarehouseId);
  }, [searchQuery, statusFilter, selectedWarehouseId]);

  // Derived Metrics & Categories
  const categories = useMemo(() => {
    const set = new Set(items.map(i => i.categoryName || 'General'));
    return ['ALL', ...Array.from(set)];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (categoryFilter === 'ALL') return items;
    return items.filter(i => (i.categoryName || 'General') === categoryFilter);
  }, [items, categoryFilter]);

  const metrics = useMemo(() => {
    const totalItems = items.length;
    const totalQty = items.reduce((acc, i) => acc + (i.quantityOnHand || 0), 0);
    const totalValuation = items.reduce((acc, i) => acc + ((i.quantityOnHand || 0) * (i.unitPrice || 0)), 0);
    const lowStockCount = items.filter(i => {
      const s = (i.status || '').toUpperCase().replace(/_/g, '');
      return s === 'LOWSTOCK' || (i.quantityOnHand || 0) <= (i.minStockLevel || i.reorderLevel || 5);
    }).length;
    return { totalItems, totalQty, totalValuation, lowStockCount };
  }, [items]);

  const activeWarehouse = useMemo(() => {
    return warehouses.find(w => w.id === selectedWarehouseId) || warehouses.find(w => w.isDefault) || warehouses[0] || null;
  }, [warehouses, selectedWarehouseId]);

  const handleCreateNew = () => {
    if (!canCreate) return;
    setSelectedItem(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    if (!canEdit) return;
    setSelectedItem(item);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleOpenAdjust = (item) => {
    if (!canAdjust) return;
    setSelectedItem(item);
    setModalMode('adjust');
    setModalOpen(true);
  };

  const handleDeleteItem = (item) => {
    if (!canDelete) return;
    setDeleteConfirm({
      isOpen: true,
      item,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.item || !canDelete) return;
    const deletedId = deleteConfirm.item.id;
    const deletedName = deleteConfirm.item.name;
    try {
      await stockService.deleteItem(deletedId);
      setItems(prev => prev.filter(i => i.id !== deletedId));
      toast.success(`Deleted item '${deletedName}' from stock successfully!`);
      setDeleteConfirm({ isOpen: false, item: null });
      await fetchItems();
    } catch (err) {
      toast.error('Failed to delete item');
    }
  };

  const handleSaveItem = async (arg1, arg2, arg3) => {
    try {
      if (modalMode === 'adjust' && selectedItem) {
        if (!canAdjust) return;
        const adjQty = typeof arg2 === 'number' ? arg2 : 0;
        const reason = arg3 || 'Inventory Adjustment';
        await stockService.adjustStock(selectedItem.id, adjQty, reason);
        toast.success(`Adjusted stock for '${selectedItem.name}' successfully!`);
      } else if (modalMode === 'edit' && selectedItem) {
        if (!canEdit) return;
        const itemData = typeof arg1 === 'object' ? arg1 : selectedItem;
        await stockService.updateItem(selectedItem.id, itemData);
        toast.success(`Updated item '${itemData.name || selectedItem.name}' successfully!`);
      } else {
        if (!canCreate) return;
        const itemData = typeof arg1 === 'object' ? arg1 : {};
        await stockService.createItem(itemData);
        toast.success(`Created new item '${itemData.name}' in stock successfully!`);
      }
      await fetchItems();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save item');
    }
  };

  const statusOptions = [
    { label: 'All Items', value: 'ALL' },
    { label: 'In Stock', value: 'IN_STOCK' },
    { label: 'Low Stock', value: 'LOW_STOCK' },
    { label: 'Out of Stock', value: 'OUT_OF_STOCK' }
  ];

  return (
    <div className="min-h-full pb-16">
      {/* Control Panel Toolbar */}
      <ControlPanel
        title="Inventory & Stock Microservice"
        subtitle="Manage product catalog, monitor warehouse inventory, and adjust stock in real time"
        onCreateNew={canCreate ? handleCreateNew : null}
        createLabel="New Item"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOptions={statusOptions}
        onRefresh={fetchItems}
        loading={loading}
      />

      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-6">
        {/* Active Warehouse Indicator & Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 px-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-[#2089C8] border border-sky-100 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  {activeWarehouse ? `${activeWarehouse.name} (${activeWarehouse.code})` : 'Main Warehouse'}
                </span>
                {activeWarehouse?.isDefault ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                    ★ Main Warehouse (Default)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    Regional Branch
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Real-time On-Hand stock quantities for this facility.
              </p>
            </div>
          </div>

          {warehouses.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="warehouse-filter-select" className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                Warehouse:
              </label>
              <select
                id="warehouse-filter-select"
                value={selectedWarehouseId || ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setSelectedWarehouseId(val);
                }}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2089C8]/20 focus:border-[#2089C8] cursor-pointer"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.isDefault ? '★ (Main Warehouse)' : `(${w.code})`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-[#2089C8] bg-white">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total SKUs</p>
              <h4 className="text-2xl font-bold font-mono text-[#2089C8] mt-1">{metrics.totalItems}</h4>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Catalog Items</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#2089C8] border border-sky-100 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-emerald-500 bg-white">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total On-Hand</p>
              <h4 className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                {metrics.totalQty.toLocaleString()} <span className="text-xs font-normal font-sans text-slate-500">units</span>
              </h4>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Available Stock</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <Boxes className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-amber-500 bg-white">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Low Stock Alerts</p>
              <h4 className="text-2xl font-bold font-mono text-amber-700 mt-1">{metrics.lowStockCount}</h4>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">Requires Reorder</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-[#2089C8] bg-white">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inventory Valuation</p>
              <h4 className="text-2xl font-bold font-mono text-slate-900 mt-1">
                ${metrics.totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
              <p className="text-[11px] text-[#2089C8] font-medium mt-0.5">Asset Value</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#2089C8] border border-sky-100 flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" /> Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                categoryFilter === cat
                  ? 'bg-[#2089C8] text-white border-[#155e89] shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-sky-50 hover:text-[#2089C8] hover:border-sky-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div className="py-24 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
            <div className="w-10 h-10 border-4 border-[#2089C8] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-medium text-slate-600">Loading stock catalogue...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-xs">
            <div className="p-4 bg-sky-50 text-[#2089C8] border border-sky-100 rounded-2xl inline-block mb-3">
              <Package className="w-10 h-10" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">No Items Found</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              No inventory items match your search or filter parameters.
            </p>
            {canCreate && (
              <button
                onClick={handleCreateNew}
                className="btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer shadow-xs inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Stock Item</span>
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4">SKU</th>
                    <th className="py-3.5 px-4">Item Name</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Location</th>
                    <th className="py-3.5 px-4">Qty On-Hand</th>
                    <th className="py-3.5 px-4">Unit Price</th>
                    <th className="py-3.5 px-4">Status</th>
                    {(canEdit || canDelete || canAdjust) && (
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-sky-50/30 transition-colors group">
                      <td className="py-3.5 px-4 font-mono font-bold">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] group-hover:border-sky-300">
                          {item.sku}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 block">{item.name}</div>
                        {item.barcode && (
                          <span className="text-[10px] font-mono text-slate-400">BC: {item.barcode}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-md bg-sky-50 text-[#1976ab] border border-sky-100 text-[11px] font-medium">
                          {item.categoryName || 'General'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 flex items-center gap-1 mt-3">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[120px]">{item.location || 'Warehouse Main'}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-sm">
                        {item.quantityOnHand} <span className="text-[10px] text-slate-400 font-normal">pcs</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        ${(item.unitPrice || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setLedgerItem(item)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                            title="View Stock Ledger & History"
                          >
                            <History className="w-3 h-3 text-[#2089C8]" />
                            <span>Ledger</span>
                          </button>

                          {canAdjust && (
                            <button
                              onClick={() => handleOpenAdjust(item)}
                              className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-[#1976ab] border border-sky-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                              title="Adjust Stock Quantity"
                            >
                              <RefreshCcw className="w-3 h-3" />
                              <span>Adjust</span>
                            </button>
                          )}

                          {canEdit && (
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 text-slate-500 hover:text-[#2089C8] hover:bg-sky-50 rounded-lg border border-slate-200 hover:border-sky-300 transition-colors cursor-pointer"
                              title="Edit Item"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 hover:border-rose-300 transition-colors cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <div key={item.id} className="erp-card p-5 flex flex-col justify-between hover:border-sky-300 hover:shadow-md transition-all group bg-white">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                      {item.sku}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>

                  <h3 className="font-bold text-slate-900 text-base group-hover:text-[#2089C8] transition-colors">
                    {item.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-slate-400" /> {item.categoryName || 'General'}
                  </p>

                  <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium block">Qty On-Hand:</span>
                      <span className="font-bold font-mono text-slate-900 text-sm">{item.quantityOnHand} pcs</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Unit Price:</span>
                      <span className="font-bold font-mono text-slate-900 text-sm">${(item.unitPrice || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setLedgerItem(item)}
                      className="px-2.5 py-1 text-slate-700 hover:text-[#2089C8] bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      title="View Ledger"
                    >
                      <History className="w-3.5 h-3.5 text-[#2089C8]" /> Ledger
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="px-2.5 py-1 text-slate-600 hover:text-[#2089C8] bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteItem(item)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-lg transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {canAdjust && (
                    <button
                      onClick={() => handleOpenAdjust(item)}
                      className="px-3 py-1 bg-sky-50 hover:bg-sky-100 text-[#1976ab] border border-sky-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" /> Adjust Qty
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <StockModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveItem}
        initialItem={selectedItem}
        mode={modalMode}
      />

      <ItemLedgerModal
        isOpen={!!ledgerItem}
        onClose={() => setLedgerItem(null)}
        item={ledgerItem}
      />

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, item: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Stock Item"
        message={`This will permanently remove ${deleteConfirm.item?.name} (${deleteConfirm.item?.sku}) from active inventory catalog.`}
        itemName={deleteConfirm.item ? `${deleteConfirm.item.sku} — ${deleteConfirm.item.name}` : ''}
        requireConfirmText={deleteConfirm.item?.sku}
        confirmText="Delete Item"
        type="danger"
      />
    </div>
  );
};

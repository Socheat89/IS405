import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, DollarSign, Package, AlertTriangle, Boxes, 
  ArrowDownLeft, ArrowUpRight, Printer, RefreshCw, 
  Layers, Tag, ShieldAlert, Sparkles, Filter, CheckCircle2, FileSpreadsheet
} from 'lucide-react';
import { stockItemService } from '../../../services/stock/stockItemService';
import { useToast } from '../../../context/ToastContext';
import { useExport } from '../../../context/ExportContext';

export const StockReportsPage = () => {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const toast = useToast();
  const { exportData } = useExport();

  const loadData = async () => {
    setLoading(true);
    try {
      const [itemsData, movementsData] = await Promise.all([
        stockItemService.getItems(),
        stockItemService.getMovements({ limit: 300 })
      ]);
      setItems(Array.isArray(itemsData) ? itemsData : []);
      setMovements(Array.isArray(movementsData) ? movementsData : []);
    } catch (err) {
      console.error('Failed to load stock reports data:', err);
      toast.error('Failed to load stock report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Category List
  const categories = useMemo(() => {
    const set = new Set(items.map(i => i.categoryName || 'General'));
    return ['ALL', ...Array.from(set)];
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    if (categoryFilter === 'ALL') return items;
    return items.filter(i => (i.categoryName || 'General') === categoryFilter);
  }, [items, categoryFilter]);

  // Valuation & Status Metrics
  const metrics = useMemo(() => {
    let totalQty = 0;
    let totalCostValuation = 0;
    let totalRetailValuation = 0;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    filteredItems.forEach(i => {
      const qty = Number(i.quantityOnHand) || 0;
      const cost = Number(i.costPrice || 0);
      const selling = Number(i.sellingPrice || i.unitPrice || 0);
      const minStock = Number(i.minStockLevel || i.reorderLevel || 5);

      totalQty += qty;
      totalCostValuation += qty * cost;
      totalRetailValuation += qty * selling;

      if (qty <= 0) {
        outOfStockCount++;
      } else if (qty <= minStock) {
        lowStockCount++;
      } else {
        inStockCount++;
      }
    });

    const potentialGrossMargin = totalRetailValuation > 0 
      ? ((totalRetailValuation - totalCostValuation) / totalRetailValuation) * 100 
      : 0;

    return {
      totalItems: filteredItems.length,
      totalQty,
      totalCostValuation,
      totalRetailValuation,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      potentialGrossMargin
    };
  }, [filteredItems]);

  // Valuation by Category Breakdown
  const categoryValuation = useMemo(() => {
    const map = {};
    items.forEach(i => {
      const cat = i.categoryName || 'General';
      if (!map[cat]) {
        map[cat] = {
          name: cat,
          itemsCount: 0,
          totalQty: 0,
          valuation: 0
        };
      }
      const qty = Number(i.quantityOnHand) || 0;
      const cost = Number(i.costPrice || 0);
      map[cat].itemsCount++;
      map[cat].totalQty += qty;
      map[cat].valuation += qty * cost;
    });

    return Object.values(map).sort((a, b) => b.valuation - a.valuation);
  }, [items]);

  // Urgent Low Stock / Reorder Warning List
  const lowStockAlerts = useMemo(() => {
    return items
      .filter(i => (i.quantityOnHand || 0) <= (i.minStockLevel || i.reorderLevel || 5))
      .sort((a, b) => (a.quantityOnHand || 0) - (b.quantityOnHand || 0));
  }, [items]);

  // Movements IN vs OUT analysis
  const movementStats = useMemo(() => {
    let totalInQty = 0;
    let totalOutQty = 0;
    let totalAdjQty = 0;

    movements.forEach(m => {
      const qty = Number(m.quantity) || 0;
      if (m.movementType === 'IN') totalInQty += qty;
      else if (m.movementType === 'OUT') totalOutQty += qty;
      else if (m.movementType === 'ADJUSTMENT') totalAdjQty += qty;
    });

    return { totalInQty, totalOutQty, totalAdjQty, count: movements.length };
  }, [movements]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-[#2089C8] flex items-center justify-center font-bold">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Inventory Valuation & Stock Analytics</h2>
              <p className="text-xs text-slate-500">Asset valuation, category distribution, stock turn, and reorder warnings</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              const dataToExport = filteredItems.map(i => ({
                itemName: i.itemName,
                category: i.categoryName || 'General',
                sku: i.sku || 'N/A',
                quantity: i.quantityOnHand || 0,
                costPrice: Number(i.costPrice || 0).toFixed(2),
                retailPrice: Number(i.retailPrice || 0).toFixed(2),
                costValuation: Number(i.costPrice || 0) * Number(i.quantityOnHand || 0),
                retailValuation: Number(i.retailPrice || 0) * Number(i.quantityOnHand || 0)
              }));
              exportData(dataToExport, [
                { header: 'Item Name', key: 'itemName' },
                { header: 'Category', key: 'category' },
                { header: 'SKU', key: 'sku' },
                { header: 'Quantity On Hand', key: 'quantity' },
                { header: 'Cost Price ($)', key: 'costPrice' },
                { header: 'Retail Price ($)', key: 'retailPrice' },
                { header: 'Total Cost Valuation ($)', key: 'costValuation' },
                { header: 'Total Retail Valuation ($)', key: 'retailValuation' }
              ], `Stock_Valuation_${new Date().toISOString().substring(0, 10)}.xlsx`);
            }}
            className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs print:hidden"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Data</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs print:hidden"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Valuation Report</span>
          </button>

          <button
            onClick={loadData}
            className="p-2 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-[#2089C8] bg-white shadow-2xs">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inventory Asset Valuation</p>
            <h4 className="text-2xl font-bold font-mono text-[#2089C8] mt-1">
              ${metrics.totalCostValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Retail: ${metrics.totalRetailValuation.toFixed(2)} ({metrics.potentialGrossMargin.toFixed(1)}% margin)
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#2089C8] border border-sky-100 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-emerald-500 bg-white shadow-2xs">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total On-Hand Quantity</p>
            <h4 className="text-2xl font-bold font-mono text-emerald-700 mt-1">
              {metrics.totalQty.toLocaleString()} <span className="text-xs font-normal text-slate-500">units</span>
            </h4>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
              Across {metrics.totalItems} active SKUs
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-amber-500 bg-white shadow-2xs">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reorder & Low Stock</p>
            <h4 className="text-2xl font-bold font-mono text-amber-700 mt-1">
              {metrics.lowStockCount} <span className="text-xs font-normal text-slate-500">items</span>
            </h4>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">
              {metrics.outOfStockCount} items completely out of stock
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-purple-500 bg-white shadow-2xs">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock Movements (Audit)</p>
            <h4 className="text-2xl font-bold font-mono text-purple-700 mt-1">
              {movementStats.count} <span className="text-xs font-normal text-slate-500">records</span>
            </h4>
            <p className="text-[11px] text-purple-600 font-medium mt-0.5">
              IN: +{movementStats.totalInQty} | OUT: -{movementStats.totalOutQty}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Category Valuation & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Valuation (6 Cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#2089C8]" />
                <h3 className="font-bold text-slate-800 text-sm">Valuation by Category</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-semibold uppercase">Cost Basis</span>
            </div>

            {categoryValuation.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No category inventory recorded.
              </div>
            ) : (
              <div className="space-y-3.5">
                {categoryValuation.map((cat, idx) => {
                  const maxVal = categoryValuation[0]?.valuation || 1;
                  const percent = Math.min(100, Math.round((cat.valuation / maxVal) * 100));

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{cat.name}</span>
                          <span className="text-[10px] text-slate-400">({cat.itemsCount} SKUs, {cat.totalQty} pcs)</span>
                        </div>
                        <div className="text-right font-mono font-bold text-slate-900">
                          ${cat.valuation.toFixed(2)}
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#2089C8] h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alerts (6 Cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-slate-800 text-sm">Low Stock & Out-of-Stock Warnings</h3>
              </div>
              <span className="text-[11px] text-amber-600 font-bold uppercase">{lowStockAlerts.length} Warnings</span>
            </div>

            {lowStockAlerts.length === 0 ? (
              <div className="py-12 text-center text-emerald-600 text-xs flex flex-col items-center">
                <CheckCircle2 className="w-8 h-8 mb-2 opacity-80" />
                <span>All inventory items are currently above safe minimum stock levels!</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {lowStockAlerts.slice(0, 8).map((item) => {
                  const isOut = (item.quantityOnHand || 0) <= 0;
                  return (
                    <div key={item.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 rounded-lg px-2 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{item.name}</span>
                          <span className="font-mono text-[10px] text-slate-400">({item.sku})</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Location: {item.location || 'Main WH'} • Reorder Level: {item.minStockLevel || item.reorderLevel || 5} {item.unit || 'PCS'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded-md ${
                          isOut ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.quantityOnHand} {item.unit || 'PCS'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

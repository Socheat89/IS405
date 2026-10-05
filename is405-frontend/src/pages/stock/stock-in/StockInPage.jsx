import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowDownToLine, Search, RefreshCcw, Package,
  Calendar, Building2, FileText, Layers, ChevronRight, Filter,
  CheckCircle2, ShoppingBag, ExternalLink, Info
} from 'lucide-react';
import { stockInService } from '../../../services/stock/stockInService';
import { ControlPanel } from '../../../components/common/ControlPanel';
import { useExport } from '../../../context/ExportContext';

export const StockInPage = ({ onNavigateToPo }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const { exportData } = useExport();

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await stockInService.getStockInRecords({ search: searchQuery });
      setRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [searchQuery]);

  const uniqueWarehouses = useMemo(() => {
    const set = new Set(records.map(r => r.warehouseName).filter(Boolean));
    return Array.from(set);
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch = !searchQuery ||
        r.referenceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.itemName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.sku?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchWarehouse = warehouseFilter === 'ALL' || r.warehouseName === warehouseFilter;
      return matchSearch && matchWarehouse;
    });
  }, [records, searchQuery, warehouseFilter]);

  const metrics = useMemo(() => {
    const totalReceived = filteredRecords.reduce((s, r) => s + (r.quantityReceived || 0), 0);
    const totalValue = filteredRecords.reduce((s, r) => s + (r.totalCost || 0), 0);
    return { totalRecords: filteredRecords.length, totalReceived, totalValue };
  }, [filteredRecords]);

  return (
    <div className="min-h-full pb-16">
      <ControlPanel
        title="Stock In Ledger (PO Receipts)"
        subtitle="Inbound inventory receipts generated strictly from Purchase Orders (Goods Receipts)"
        onCreateNew={null} // No manual arbitrary creation in inventory
        onExport={() => {
          const dataToExport = filteredRecords.map(r => ({
            receiptRef: r.referenceNo,
            poRef: r.poNumber || 'N/A',
            grnDate: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A',
            destination: r.warehouse || 'N/A',
            receivedBy: r.receivedBy || 'N/A',
            notes: r.notes || ''
          }));
          exportData(dataToExport, [
            { header: 'Receipt / GRN #', key: 'receiptRef' },
            { header: 'PO Ref #', key: 'poRef' },
            { header: 'Receipt Date', key: 'grnDate' },
            { header: 'Destination Warehouse', key: 'destination' },
            { header: 'Received By', key: 'receivedBy' },
            { header: 'Notes', key: 'notes' }
          ], `Stock_In_Ledger_${new Date().toISOString().substring(0, 10)}.xlsx`);
        }}
      />

      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-6">
        {/* Business Rule Notice Banner */}
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4.5 flex items-start justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#2089C8] text-white rounded-xl shrink-0 mt-0.5 shadow-xs border border-[#155e89]">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#155e89] tracking-tight uppercase">
                Audit Compliance Rule: Stock-In via Purchase Orders (PO)
              </h4>
              <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                Direct manual stock-in without reference is restricted. All inbound inventory must be processed through
                <strong className="text-[#155e89]"> Purchase Orders (Goods Receipts / GRN)</strong> into the designated warehouse facility.
              </p>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="p-3 bg-sky-50 text-[#2089C8] rounded-xl border border-sky-100">
              <ArrowDownToLine className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{metrics.totalRecords}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inward Receipts</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-700">{metrics.totalReceived.toLocaleString()}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Units Received</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="p-3 bg-sky-50 text-[#1976ab] rounded-xl border border-sky-100">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">${metrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Received Value</div>
            </div>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Search by PO #, SKU, Item, Supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input form-input-search !pl-9.5 pr-4 py-2 w-full text-xs font-medium text-slate-800"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Warehouse Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-500">WH:</span>
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Facilities</option>
                {uniqueWarehouses.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchRecords}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
              title="Refresh Inbound Records"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Inbound Movement Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Receipt / PO Reference</th>
                  <th className="py-3.5 px-4">Warehouse</th>
                  <th className="py-3.5 px-4">Product Item</th>
                  <th className="py-3.5 px-4 text-right">Qty Received</th>
                  <th className="py-3.5 px-4 text-right">Unit Cost</th>
                  <th className="py-3.5 px-4 text-right">Total Cost</th>
                  <th className="py-3.5 px-4">Supplier / Source</th>
                  <th className="py-3.5 px-4">Recorded Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      <RefreshCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                      Loading inbound stock records...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      <ArrowDownToLine className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No stock-in records found.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-blue-900 flex items-center gap-1.5">
                          <span className="p-1 bg-blue-50 rounded text-blue-700 text-[10px]">PO-GRN</span>
                          {r.referenceNo}
                        </div>
                        {r.notes && (
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{r.notes}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {r.warehouseName || 'Main Warehouse'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{r.itemName}</div>
                        <div className="font-mono text-[11px] text-slate-400">{r.sku}</div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          +{r.quantityReceived}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                        ${Number(r.unitCost || 0).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        ${Number(r.totalCost || 0).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-700">{r.supplier}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-700">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}
                        </div>
                        <div className="text-[11px] text-slate-400">by {r.recordedBy}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

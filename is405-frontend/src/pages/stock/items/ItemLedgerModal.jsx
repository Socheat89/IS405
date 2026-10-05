import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, History, ArrowDownLeft, ArrowUpRight, RefreshCcw, 
  ArrowLeftRight, Calendar, User, FileText, Download, 
  Printer, Filter, Search, Tag, DollarSign, Package, AlertCircle
} from 'lucide-react';
import { stockItemService } from '../../../services/stock/stockItemService';

export const ItemLedgerModal = ({ isOpen, onClose, item }) => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && item?.id) {
      loadHistory();
    }
  }, [isOpen, item]);

  // Handle printing modal lifecycle
  useEffect(() => {
    if (!isOpen) return;
    const handleBeforePrint = () => document.body.classList.add('printing-modal');
    const handleAfterPrint = () => document.body.classList.remove('printing-modal');
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-modal');
    };
  }, [isOpen]);

  const handlePrint = () => {
    document.body.classList.add('printing-modal');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-modal');
    }, 1000);
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await stockItemService.getMovements({ itemId: item.id, limit: 200 });
      setMovements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load item movements:', err);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const matchesType = filterType === 'ALL' || m.movementType?.toUpperCase() === filterType;
      const matchesSearch = !searchTerm || 
        m.referenceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.supplierOrRecipient?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [movements, filterType, searchTerm]);

  // Movement Statistics
  const stats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalAdj = 0;
    
    movements.forEach(m => {
      const qty = Number(m.quantity) || 0;
      if (m.movementType === 'IN') totalIn += qty;
      else if (m.movementType === 'OUT') totalOut += qty;
      else if (m.movementType === 'ADJUSTMENT') totalAdj += qty;
    });

    return { totalIn, totalOut, totalAdj, count: movements.length };
  }, [movements]);

  if (!isOpen || !item) return null;

  const getTypeBadge = (type) => {
    switch (type?.toUpperCase()) {
      case 'IN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ArrowDownLeft className="w-3 h-3" /> Stock IN
          </span>
        );
      case 'OUT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <ArrowUpRight className="w-3 h-3" /> Stock OUT
          </span>
        );
      case 'ADJUSTMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <RefreshCcw className="w-3 h-3" /> Adjustment
          </span>
        );
      case 'TRANSFER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <ArrowLeftRight className="w-3 h-3" /> Transfer
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
            {type || 'Record'}
          </span>
        );
    }
  };

  return (
    <div className="item-ledger-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="item-ledger-modal-card bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-[#2089C8] flex items-center justify-center font-bold">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">
                  Product Item Ledger & History
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700 font-mono text-xs font-semibold">
                  {item.sku}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {item.name} • {item.categoryName || 'General Category'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer print:hidden"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Ledger</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer print:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Product Snapshot Bar */}
        <div className="px-6 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Current Balance</span>
              <span className="text-lg font-mono font-bold text-emerald-400">
                {item.quantityOnHand ?? 0} <span className="text-xs text-slate-300 font-sans">{item.unit || 'PCS'}</span>
              </span>
            </div>
            <div className="h-7 w-px bg-slate-800"></div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Selling Price</span>
              <span className="text-sm font-mono font-bold text-sky-400">
                ${Number(item.unitPrice || item.sellingPrice || 0).toFixed(2)}
              </span>
            </div>
            <div className="h-7 w-px bg-slate-800"></div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Cost Price</span>
              <span className="text-sm font-mono font-bold text-slate-200">
                ${Number(item.costPrice || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-4 text-[11px] font-medium">
            <span className="text-emerald-300">Total In: +{stats.totalIn}</span>
            <span className="text-sky-300">Total Out: -{stats.totalOut}</span>
            <span className="text-amber-300">Adjustments: {stats.totalAdj}</span>
            <span className="text-slate-400">Total Entries: {stats.count}</span>
          </div>
        </div>

        {/* Toolbar / Filters */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reference, reason, user..."
                className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-sky-500 focus:bg-white"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {['ALL', 'IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'].map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                    filterType === type 
                      ? 'bg-white text-[#2089C8] shadow-xs font-bold' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type === 'ALL' ? 'All Types' : type}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={loadHistory}
            className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs">Loading ledger transactions...</p>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="py-16 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No Transaction Records Found</p>
              <p className="text-xs text-slate-400 mt-0.5">There are no stock movements recorded for this product yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider">
                    <th className="py-3 px-3.5">Date & Time</th>
                    <th className="py-3 px-3.5">Type</th>
                    <th className="py-3 px-3.5">Ref No / Doc</th>
                    <th className="py-3 px-3.5">Reason / Details</th>
                    <th className="py-3 px-3.5 text-right">Qty Change</th>
                    <th className="py-3 px-3.5 text-right">Balance After</th>
                    <th className="py-3 px-3.5">Party / Source</th>
                    <th className="py-3 px-3.5">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredMovements.map((m) => {
                    const isIn = m.movementType === 'IN';
                    const isOut = m.movementType === 'OUT';
                    const isAdj = m.movementType === 'ADJUSTMENT';

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                          {m.createdAtUtc ? new Date(m.createdAtUtc).toLocaleString('km-KH', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {getTypeBadge(m.movementType)}
                        </td>
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-700">
                          {m.referenceNo || `MOV-${m.id}`}
                        </td>
                        <td className="py-3 px-3.5 text-slate-700 max-w-[200px] truncate" title={m.reason || m.notes}>
                          <span className="font-medium text-slate-800">{m.reason || 'General Movement'}</span>
                          {m.notes && <span className="block text-[10px] text-slate-400 truncate">{m.notes}</span>}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold">
                          <span className={isIn ? 'text-emerald-600' : isOut ? 'text-rose-600' : 'text-amber-600'}>
                            {isIn ? `+${m.quantity}` : isOut ? `-${m.quantity}` : `${m.quantity}`}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                          {m.balanceAfter !== null && m.balanceAfter !== undefined ? m.balanceAfter : '—'} {item.unit || 'PCS'}
                        </td>
                        <td className="py-3 px-3.5 text-slate-600 truncate max-w-[140px]" title={m.supplierOrRecipient}>
                          {m.supplierOrRecipient || '—'}
                        </td>
                        <td className="py-3 px-3.5 text-slate-500 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <User className="w-3 h-3 text-slate-400" />
                            {m.createdByUsername || 'System'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <span>Showing {filteredMovements.length} of {movements.length} total movement entries</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowUpFromLine, Search, RefreshCcw, Package,
  Calendar, Building2, FileText, Layers, ChevronRight, Filter,
  DollarSign, ShoppingCart, Info, Truck, CheckCircle2, Clock,
  AlertTriangle, X, ChevronDown, Check, User, Printer, Download
} from 'lucide-react';
import { stockOutService } from '../../../services/stock/stockOutService';
import { salesService } from '../../../services/sales/salesService';
import { warehouseService } from '../../../services/stock/warehouseService';
import { ControlPanel } from '../../../components/common/ControlPanel';
import { InvoiceModal } from '../../../components/common/InvoiceModal';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useExport } from '../../../context/ExportContext';

export const StockOutPage = ({ onNavigateToSales }) => {
  const toast = useToast();
  const { hasPermission, user } = useAuth();
  const { exportData } = useExport();
  const canDispatch = user?.isAdmin || hasPermission('stock-out.create') || hasPermission('stock.manage') || hasPermission('sales.manage') || hasPermission('sales-orders.confirm');

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [records, setRecords] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingPending, setLoadingPending] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');

  // Delivery Note (DN) Print State
  const [printDeliveryNoteData, setPrintDeliveryNoteData] = useState(null);

  // Dispatch Confirmation Modal State
  const [dispatchModalOrder, setDispatchModalOrder] = useState(null);
  const [dispatchWarehouseId, setDispatchWarehouseId] = useState('');
  const [dispatchWhStocks, setDispatchWhStocks] = useState({});
  const [loadingModalStocks, setLoadingModalStocks] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState('');

  // Fetch Outbound Ledger History
  const fetchHistoryRecords = async () => {
    setLoadingHistory(true);
    try {
      const data = await stockOutService.getStockOutRecords({ search: searchQuery });
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching stock-out history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch Pending Confirmed Sales Orders waiting for Warehouse Delivery
  const fetchPendingOrders = async () => {
    setLoadingPending(true);
    try {
      const data = await salesService.getSalesOrders({ status: 'CONFIRMED' });
      const list = Array.isArray(data) ? data : (data?.items || []);
      const confirmedOnly = list.filter(o => {
        const st = (o.status || '').toUpperCase();
        return st === 'CONFIRMED' || st === 'SALES_ORDER';
      });
      setPendingOrders(confirmedOnly);
    } catch (err) {
      console.error('Error fetching pending sales deliveries:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  // Fetch Warehouses
  const fetchWarehouses = async () => {
    try {
      const whList = await warehouseService.getWarehouses(true);
      setWarehouses(Array.isArray(whList) ? whList : []);
    } catch (err) {
      console.error('Error fetching warehouses:', err);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistoryRecords();
    } else {
      fetchPendingOrders();
    }
  }, [searchQuery, activeTab]);

  const refreshAll = async () => {
    await Promise.all([fetchPendingOrders(), fetchHistoryRecords()]);
  };

  // Open Dispatch Modal for a given confirmed order
  const handleOpenDispatchModal = async (order) => {
    setDispatchError('');
    setDispatchModalOrder(order);
    const targetWhId = order.warehouseId || (warehouses.length > 0 ? warehouses[0].id : '');
    setDispatchWarehouseId(targetWhId);
    await loadWarehouseStocksForModal(targetWhId);
  };

  const loadWarehouseStocksForModal = async (whId) => {
    if (!whId) {
      setDispatchWhStocks({});
      return;
    }
    setLoadingModalStocks(true);
    try {
      const stockList = await warehouseService.getWarehouseStocks({ warehouseId: Number(whId), pageSize: 1000 });
      const map = {};
      if (Array.isArray(stockList)) {
        stockList.forEach(s => {
          const pId = s.productId || s.itemId;
          if (pId) {
            map[pId] = Number(s.quantityOnHand ?? s.quantity ?? 0);
          }
        });
      }
      setDispatchWhStocks(map);
    } catch (err) {
      console.warn('Failed to load warehouse stocks for dispatch modal:', err);
    } finally {
      setLoadingModalStocks(false);
    }
  };

  const handleWarehouseChangeInModal = async (newWhId) => {
    setDispatchWarehouseId(newWhId);
    await loadWarehouseStocksForModal(newWhId);
  };

  // Confirm Delivery and Deduct Warehouse Stock
  const handleConfirmDelivery = async () => {
    if (!dispatchModalOrder || !dispatchWarehouseId) {
      setDispatchError('Please select an active warehouse to dispatch from.');
      return;
    }

    // Client-side stock safety check
    const items = dispatchModalOrder.items || [];
    const whObj = warehouses.find(w => String(w.id) === String(dispatchWarehouseId));
    const whName = whObj?.name || 'Selected Warehouse';

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const pId = it.productId || it.id;
      const avail = dispatchWhStocks[pId] ?? 0;
      const requested = Number(it.quantity) || 0;
      if (requested > avail) {
        setDispatchError(`Cannot dispatch: Insufficient stock for "${it.productName || it.itemName}" in ${whName}! Available: ${avail}, Required: ${requested}. Please restock or transfer goods first.`);
        return;
      }
    }

    setDispatching(true);
    setDispatchError('');
    try {
      await salesService.deliverSalesOrder(dispatchModalOrder.id, Number(dispatchWarehouseId));
      toast?.success?.(`Delivery confirmed! Order ${dispatchModalOrder.invoiceNumber || dispatchModalOrder.soNumber} dispatched and stock deducted from ${whName}.`);
      
      const finishedOrder = { ...dispatchModalOrder };
      setDispatchModalOrder(null);
      await refreshAll();

      // Automatically open Delivery Note for printing
      handlePrintDeliveryNote(finishedOrder, whName);
    } catch (err) {
      console.error('Dispatch error:', err);
      const msg = typeof err === 'string'
        ? err
        : err?.response?.data?.message || err?.message || 'Failed to complete delivery dispatch.';
      setDispatchError(msg);
    } finally {
      setDispatching(false);
    }
  };

  // Delivery Note (DN) Trigger for an order
  const handlePrintDeliveryNote = (order, explicitWarehouseName) => {
    const whName = explicitWarehouseName || order.warehouseName || (warehouses.find(w => String(w.id) === String(order.warehouseId))?.name) || 'Main Warehouse';
    setPrintDeliveryNoteData({
      ...order,
      warehouseName: whName,
      customerName: order.customerName || 'Customer',
      customerPhone: order.customerPhone || order.phone || 'N/A',
      createdByUsername: user?.username || order.createdByUsername || 'Warehouse Supervisor',
      status: 'DELIVERED',
      deliveryDate: order.deliveryDate || order.updatedAt || new Date().toISOString(),
      items: order.items || []
    });
  };

  // Delivery Note from a history record
  const handlePrintDeliveryNoteFromRecord = (record) => {
    setPrintDeliveryNoteData({
      id: record.id,
      invoiceNumber: record.referenceNo,
      soNumber: record.referenceNo,
      warehouseName: record.warehouseName || 'Main Warehouse',
      warehouseId: record.warehouseId,
      customerName: record.customer || 'Customer',
      customerPhone: 'N/A',
      createdByUsername: record.dispatchedBy || user?.username || 'Warehouse Officer',
      status: 'DELIVERED',
      deliveryDate: record.createdAt || new Date().toISOString(),
      notes: record.notes || 'Warehouse Outbound Dispatch Verified',
      items: [
        {
          productName: record.itemName,
          itemName: record.itemName,
          productSku: record.sku,
          sku: record.sku,
          quantity: record.quantityDispatched,
          unit: 'PCS'
        }
      ]
    });
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (activeTab === 'pending') {
      const dataToExport = filteredPending.map(o => ({
        soNumber: o.invoiceNumber || o.soNumber || `SO-#${o.id}`,
        date: o.orderDate || (o.saleDateUtc ? o.saleDateUtc.substring(0, 10) : 'N/A'),
        customer: o.customerName || 'N/A',
        warehouse: o.warehouseName || 'Main Warehouse',
        itemNames: (o.items || []).map(it => `${it.productName || it.itemName} (x${it.quantity})`).join(', '),
        totalQty: (o.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0),
        totalAmount: Number(o.totalAmount || 0).toFixed(2),
        status: 'Awaiting Dispatch'
      }));

      exportData(dataToExport, [
        { header: 'SO / Invoice #', key: 'soNumber' },
        { header: 'Order Date', key: 'date' },
        { header: 'Customer Name', key: 'customer' },
        { header: 'Warehouse', key: 'warehouse' },
        { header: 'Item Breakdown', key: 'itemNames' },
        { header: 'Total Quantity', key: 'totalQty' },
        { header: 'Order Value ($)', key: 'totalAmount' },
        { header: 'Status', key: 'status' }
      ], `Pending_Deliveries_${new Date().toISOString().substring(0, 10)}.xlsx`);
    } else {
      const dataToExport = filteredRecords.map(r => ({
        ref: r.referenceNo,
        warehouse: r.warehouseName || 'Main Warehouse',
        item: r.itemName,
        sku: r.sku || 'N/A',
        qty: r.quantityDispatched,
        unitPrice: Number(r.unitPrice || 0).toFixed(2),
        totalValue: Number(r.totalValue || 0).toFixed(2),
        customer: r.customer || 'N/A',
        date: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A',
        dispatchedBy: r.dispatchedBy || 'N/A',
        notes: r.notes || ''
      }));

      exportData(dataToExport, [
        { header: 'Invoice / Ref #', key: 'ref' },
        { header: 'Origin Warehouse', key: 'warehouse' },
        { header: 'Product Item', key: 'item' },
        { header: 'SKU', key: 'sku' },
        { header: 'Dispatched Qty', key: 'qty' },
        { header: 'Unit Price ($)', key: 'unitPrice' },
        { header: 'Total Value ($)', key: 'totalValue' },
        { header: 'Customer / Destination', key: 'customer' },
        { header: 'Dispatched Date', key: 'date' },
        { header: 'Dispatched By', key: 'dispatchedBy' },
        { header: 'Notes', key: 'notes' }
      ], `Stock_Out_Ledger_${new Date().toISOString().substring(0, 10)}.xlsx`);
    }
  };

  const uniqueWarehouses = useMemo(() => {
    const set = new Set(warehouses.map(w => w.name).filter(Boolean));
    records.forEach(r => { if (r.warehouseName) set.add(r.warehouseName); });
    return Array.from(set);
  }, [warehouses, records]);

  // Filtered pending orders
  const filteredPending = useMemo(() => {
    return pendingOrders.filter(o => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        (o.invoiceNumber || o.soNumber)?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        (o.items && o.items.some(i => (i.productName || i.itemName || i.productSku)?.toLowerCase().includes(q)));

      const matchWh = warehouseFilter === 'ALL' ||
        o.warehouseName === warehouseFilter ||
        String(o.warehouseId) === String(warehouseFilter);

      return matchSearch && matchWh;
    });
  }, [pendingOrders, searchQuery, warehouseFilter]);

  // Filtered history records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch = !searchQuery ||
        r.referenceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.itemName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.customer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.sku?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchWarehouse = warehouseFilter === 'ALL' || r.warehouseName === warehouseFilter;
      return matchSearch && matchWarehouse;
    });
  }, [records, searchQuery, warehouseFilter]);

  const historyMetrics = useMemo(() => {
    const totalDispatched = filteredRecords.reduce((s, r) => s + (r.quantityDispatched || 0), 0);
    const totalValue = filteredRecords.reduce((s, r) => s + (r.totalValue || 0), 0);
    return { totalRecords: filteredRecords.length, totalDispatched, totalValue };
  }, [filteredRecords]);

  return (
    <div className="min-h-full pb-16">
      <ControlPanel
        title="Stock Out & Delivery Dispatch"
        subtitle="Verify warehouse stock, confirm outbound customer deliveries, and record physical stock deduction"
        onCreateNew={null}
      />

      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-6">
        {/* Workflow Compliance Notice Banner */}
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4.5 flex items-start justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#2089C8] text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-sky-900 tracking-tight uppercase">
                Stock Module Delivery &amp; Stock-Out Workflow
              </h4>
              <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                Sales orders in <strong className="text-sky-900 font-semibold">CONFIRMED</strong> status await dispatch confirmation from warehouse staff here. When you click <strong className="text-emerald-700 font-semibold">Confirm Delivery</strong>, inventory is strictly verified, physical stock is deducted from your designated warehouse, and an official Delivery Note (DN / ប័ណ្ណប្រគល់ទំនិញ - no prices) is ready for immediate printing.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pending Deliveries</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {pendingOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#2089C8] text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <ArrowUpFromLine className="w-4 h-4" />
            <span>Dispatched History (Stock-Out Ledger)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'history' ? 'bg-[#1976ab] text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {records.length}
            </span>
          </button>
        </div>

        {/* Metric Cards */}
        {activeTab === 'history' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                <ArrowUpFromLine className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{historyMetrics.totalRecords}</div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Dispatches</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
              <div className="p-3 bg-sky-50 text-[#2089C8] rounded-xl border border-sky-100">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{historyMetrics.totalDispatched.toLocaleString()}</div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Units Dispatched</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-700">${historyMetrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Dispatched Value</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4 border-l-4 border-l-amber-500">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{pendingOrders.length}</div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Awaiting Delivery</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4 border-l-4 border-l-sky-500">
              <div className="p-3 bg-sky-50 text-[#2089C8] rounded-xl border border-sky-100">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  {pendingOrders.reduce((sum, o) => sum + (o.items ? o.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0) : 0), 0)}
                </div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Units to Dispatch</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4 border-l-4 border-l-emerald-500">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-700">
                  ${pendingOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Order Value</div>
              </div>
            </div>
          </div>
        )}

        {/* Filter / Search Bar with Excel Export Button */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <input
              type="text"
              placeholder={activeTab === 'pending' ? 'Search by SO #, Customer, Product...' : 'Search by Invoice #, SKU, Item, Customer...'}
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

            {/* Export to Excel Button */}
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export displayed records to Microsoft Excel"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={refreshAll}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCcw className={`w-4 h-4 ${(loadingHistory || loadingPending) ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>


        {/* TAB 1: PENDING DELIVERIES */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {loadingPending ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-2xs">
                <RefreshCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#2089C8]" />
                <p className="text-xs font-medium">Checking pending sales deliveries...</p>
              </div>
            ) : filteredPending.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-2xs">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400 opacity-60" />
                <h4 className="text-sm font-bold text-slate-700">All Deliveries Complete</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  No confirmed sales orders are currently awaiting dispatch. New orders confirmed in the Sales module will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredPending.map((order) => {
                  const items = order.items || [];
                  return (
                    <div 
                      key={order.id} 
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 hover:border-[#2089C8]/40 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                    >
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                            {order.invoiceNumber || order.soNumber || `SO-#${order.id}`}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Awaiting Warehouse Dispatch
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Order Date: {order.orderDate || (order.saleDateUtc ? order.saleDateUtc.substring(0, 10) : 'N/A')}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>Customer: {order.customerName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                            <Building2 className="w-3.5 h-3.5 text-[#2089C8]" />
                            <span>Origin Warehouse: <strong className="text-slate-900">{order.warehouseName || 'Main Warehouse'}</strong></span>
                          </div>
                          <div className="font-bold font-mono text-emerald-700">
                            Total: ${(order.totalAmount || 0).toFixed(2)}
                          </div>
                        </div>

                        {/* Items Preview Chips */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {items.map((it, idx) => (
                            <span 
                              key={idx} 
                              className="px-2.5 py-1 bg-slate-50 border border-slate-200/90 rounded-lg text-[11px] font-medium text-slate-700 flex items-center gap-1.5"
                            >
                              <Package className="w-3 h-3 text-slate-400" />
                              <strong className="text-slate-900">{it.productName || it.itemName}</strong>
                              <span className="font-mono text-rose-700 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                ×{it.quantity}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Delivery Action Button */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                        <button
                          type="button"
                          onClick={() => handlePrintDeliveryNote(order)}
                          className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          title="Print Delivery Note / Packing Slip (No Prices)"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-500" />
                          <span>Print DN</span>
                        </button>

                        {canDispatch && (
                          <button
                            type="button"
                            onClick={() => handleOpenDispatchModal(order)}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer hover:shadow"
                          >
                            <Truck className="w-4 h-4" />
                            <span>Confirm Delivery &amp; Deduct Stock</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DISPATCHED HISTORY (STOCK-OUT LEDGER) */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Invoice / SO Reference</th>
                    <th className="py-3.5 px-4">Origin Warehouse</th>
                    <th className="py-3.5 px-4">Product Item</th>
                    <th className="py-3.5 px-4 text-right">Qty Dispatched</th>
                    <th className="py-3.5 px-4 text-right">Unit Price</th>
                    <th className="py-3.5 px-4 text-right">Total Value</th>
                    <th className="py-3.5 px-4">Customer / Destination</th>
                    <th className="py-3.5 px-4">Dispatched Date</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {loadingHistory ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-400">
                        <RefreshCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-600" />
                        Loading outbound stock records...
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-400">
                        <ArrowUpFromLine className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No stock-out records found.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-rose-900 flex items-center gap-1.5">
                            <span className="p-1 bg-rose-50 rounded text-rose-700 text-[10px]">SALES</span>
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            -{r.quantityDispatched}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                          ${Number(r.unitPrice || 0).toFixed(2)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                          ${Number(r.totalValue || 0).toFixed(2)}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-700">{r.customer}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-700">
                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}
                          </div>
                          <div className="text-[11px] text-slate-400">by {r.dispatchedBy}</div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handlePrintDeliveryNoteFromRecord(r)}
                            className="inline-flex items-center justify-center whitespace-nowrap gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
                            title="Print Delivery Note (DN / Packing Slip - No Prices)"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-500" />
                            <span>Print DN</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* DISPATCH CONFIRMATION MODAL */}
      {dispatchModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-white">
                    Confirm Warehouse Delivery ({dispatchModalOrder.invoiceNumber || dispatchModalOrder.soNumber})
                  </h2>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    Deduct physical stock and dispatch goods to customer
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setDispatchModalOrder(null)} 
                className="p-1.5 hover:bg-white/10 rounded-xl text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {dispatchError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-start gap-2 shadow-2xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span className="font-semibold leading-relaxed">{dispatchError}</span>
                </div>
              )}

              {/* Order Overview */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Customer:</span>
                  <span className="font-bold text-slate-800">{dispatchModalOrder.customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Order Total:</span>
                  <span className="font-mono font-bold text-emerald-700">${(dispatchModalOrder.totalAmount || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Warehouse Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#2089C8]" />
                  <span>Dispatching From Warehouse</span>
                </label>
                <div className="relative">
                  <select
                    value={dispatchWarehouseId}
                    onChange={(e) => handleWarehouseChangeInModal(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8] cursor-pointer appearance-none pr-8"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Stock Items Checklist */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Items to Deduct from Warehouse</span>
                </label>

                <div className="space-y-2">
                  {(dispatchModalOrder.items || []).map((item, idx) => {
                    const pId = item.productId || item.id;
                    const avail = dispatchWhStocks[pId] ?? 0;
                    const requested = Number(item.quantity) || 0;
                    const isSufficient = avail >= requested;

                    return (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition-colors ${
                          isSufficient 
                            ? 'bg-slate-50/90 border-slate-200' 
                            : 'bg-rose-50/80 border-rose-200'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900">{item.productName || item.itemName}</div>
                          <div className="font-mono text-[11px] text-slate-400">{item.productSku || 'SKU-N/A'}</div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-rose-700 font-mono">
                            Dispatch Qty: {requested}
                          </div>
                          <div className="mt-0.5">
                            {loadingModalStocks ? (
                              <span className="text-[10px] text-slate-400">Verifying stock...</span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                isSufficient 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}>
                                {isSufficient ? `In Stock: ${avail} avail` : `Low Stock: only ${avail} avail`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDispatchModalOrder(null)}
                className="btn-secondary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelivery}
                disabled={dispatching || loadingModalStocks}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm flex items-center gap-2 transition-all"
              >
                {dispatching ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Deducting Stock &amp; Delivering...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Delivery &amp; Deduct Stock</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELIVERY NOTE (DN) PRINT MODAL - NO PRICES */}
      <InvoiceModal
        isOpen={Boolean(printDeliveryNoteData)}
        onClose={() => setPrintDeliveryNoteData(null)}
        type="DELIVERY_NOTE"
        data={printDeliveryNoteData}
      />
    </div>
  );
};


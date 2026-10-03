import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, ShoppingBag, Plus, Trash2, Calculator, Calendar, 
  Building, Warehouse, Clock, Package, DollarSign, 
  Info, AlertCircle, Sparkles, Check, ChevronDown
} from 'lucide-react';
import { stockItemService } from '../../../services/stock/stockItemService';
import { purchaseService } from '../../../services/po/purchaseService';
import { SearchableItemSelect } from '../../../components/common/SearchableItemSelect';

export const PurchaseOrderModal = ({ isOpen, onClose, onSave, initialPO = null, mode = 'create' }) => {
  // Form State
  const [supplierId, setSupplierId] = useState(initialPO?.supplierId || '');
  const [vendorName, setVendorName] = useState(initialPO?.vendorName || initialPO?.supplierName || '');
  const [warehouseId, setWarehouseId] = useState(initialPO?.warehouseId || '');
  const [expectedDate, setExpectedDate] = useState(() => (
    initialPO?.expectedDate || 
    (initialPO?.expectedDateUtc ? initialPO.expectedDateUtc.substring(0, 10) : new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10))
  ));
  const [paymentTerms, setPaymentTerms] = useState(initialPO?.paymentTerms || 'Net 30');
  const [notes, setNotes] = useState(initialPO?.notes || '');
  const [tax, setTax] = useState(Number(initialPO?.tax) || 0);
  const [discount, setDiscount] = useState(Number(initialPO?.discount) || 0);

  // Line items state
  const [items, setItems] = useState([]);

  // Data sources
  const [stockCatalog, setStockCatalog] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isCustomSupplier, setIsCustomSupplier] = useState(false);

  // Load Inventory items, Suppliers, and Warehouses on open
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const loadPrerequisites = async () => {
      setLoadingData(true);
      try {
        const [catalogData, suppliersData, warehousesData] = await Promise.all([
          stockItemService.getItems().catch(() => []),
          purchaseService.getSuppliers().catch(() => []),
          purchaseService.getWarehouses().catch(() => [])
        ]);

        if (!isMounted) return;

        setStockCatalog(Array.isArray(catalogData) ? catalogData : []);
        setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
        setWarehouses(Array.isArray(warehousesData) ? warehousesData : []);

        // Default warehouse if not set
        if (!initialPO?.warehouseId && warehousesData && warehousesData.length > 0) {
          const mainWh = warehousesData.find(w => w.code === 'WH-MAIN') || warehousesData[0];
          setWarehouseId(mainWh.id);
        }

        // Initialize Line Items
        if (initialPO?.items && initialPO.items.length > 0) {
          setItems(initialPO.items.map(i => {
            const matchedItem = catalogData.find(c => c.id === (i.productId || i.itemId) || c.sku === i.productSku || c.name === i.productName);
            return {
              productId: i.productId || i.itemId || (matchedItem ? matchedItem.id : null),
              productSku: i.productSku || i.sku || (matchedItem ? matchedItem.sku : ''),
              itemName: i.productName || i.itemName || (matchedItem ? matchedItem.name : ''),
              quantity: Number(i.quantity) || 1,
              unitCost: !isNaN(Number(i.unitCost)) && Number(i.unitCost) > 0 ? Number(i.unitCost) : (Number(matchedItem?.costPrice) || 0),
              stockOnHand: matchedItem?.quantityOnHand || 0,
              discount: Number(i.discount) || 0,
              tax: Number(i.tax) || 0,
              isCustom: !matchedItem && !i.productId
            };
          }));
        } else if (catalogData && catalogData.length > 0) {
          // Default first line item from inventory
          const firstItem = catalogData[0];
          setItems([{
            productId: firstItem.id,
            productSku: firstItem.sku,
            itemName: firstItem.name,
            quantity: 10,
            unitCost: Number(firstItem.costPrice) || 0,
            stockOnHand: firstItem.quantityOnHand || 0,
            discount: 0,
            tax: 0,
            isCustom: false
          }]);
        } else {
          setItems([{
            productId: null,
            productSku: '',
            itemName: '',
            quantity: 1,
            unitCost: 0,
            stockOnHand: 0,
            discount: 0,
            tax: 0,
            isCustom: true
          }]);
        }

        // Initialize Supplier
        if (initialPO?.supplierId) {
          setSupplierId(initialPO.supplierId);
          const s = suppliersData.find(sup => sup.id === initialPO.supplierId);
          if (s) {
            setVendorName(s.name);
            if (s.paymentTerms) setPaymentTerms(s.paymentTerms);
          }
        } else if (initialPO?.vendorName || initialPO?.supplierName) {
          const vName = initialPO.vendorName || initialPO.supplierName;
          const s = suppliersData.find(sup => sup.name?.toLowerCase() === vName.toLowerCase());
          if (s) {
            setSupplierId(s.id);
            setVendorName(s.name);
            if (s.paymentTerms) setPaymentTerms(s.paymentTerms);
          } else {
            setVendorName(vName);
            setIsCustomSupplier(true);
          }
        } else if (suppliersData && suppliersData.length > 0) {
          setSupplierId(suppliersData[0].id);
          setVendorName(suppliersData[0].name);
          if (suppliersData[0].paymentTerms) setPaymentTerms(suppliersData[0].paymentTerms);
        }
      } catch (err) {
        console.error('Error loading PO prerequisites:', err);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    };

    loadPrerequisites();
    return () => { isMounted = false; };
  }, [isOpen, initialPO]);

  // Handle supplier selection change
  const handleSupplierChange = (e) => {
    const val = e.target.value;
    if (val === 'CUSTOM') {
      setIsCustomSupplier(true);
      setSupplierId('');
      setVendorName('');
    } else {
      setIsCustomSupplier(false);
      const sId = Number(val);
      setSupplierId(sId);
      const s = suppliers.find(sup => sup.id === sId);
      if (s) {
        setVendorName(s.name);
        if (s.paymentTerms) setPaymentTerms(s.paymentTerms);
      }
    }
  };

  // Add line item
  const addItemRow = () => {
    if (stockCatalog.length > 0) {
      const firstItem = stockCatalog[0];
      setItems(prev => [
        ...prev,
        {
          productId: firstItem.id,
          productSku: firstItem.sku,
          itemName: firstItem.name,
          quantity: 1,
          unitCost: Number(firstItem.costPrice) || 0,
          stockOnHand: firstItem.quantityOnHand || 0,
          discount: 0,
          tax: 0,
          isCustom: false
        }
      ]);
    } else {
      setItems(prev => [
        ...prev,
        {
          productId: null,
          productSku: '',
          itemName: '',
          quantity: 1,
          unitCost: 0,
          stockOnHand: 0,
          discount: 0,
          tax: 0,
          isCustom: true
        }
      ]);
    }
  };

  // Remove line item
  const removeItemRow = (index) => {
    if (items.length <= 1) {
      setItems([{
        productId: null,
        productSku: '',
        itemName: '',
        quantity: 1,
        unitCost: 0,
        discount: 0,
        tax: 0,
        isCustom: true
      }]);
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Handle selecting an inventory stock item for a row
  const handleSelectInventoryItem = (index, selectedId) => {
    if (selectedId === 'CUSTOM') {
      setItems(prev => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          productId: null,
          productSku: '',
          itemName: '',
          unitCost: 0,
          stockOnHand: 0,
          isCustom: true
        };
        return copy;
      });
      return;
    }

    const stockItem = stockCatalog.find(c => c.id === Number(selectedId));
    if (!stockItem) return;

    setItems(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        productId: stockItem.id,
        productSku: stockItem.sku,
        itemName: stockItem.name,
        unitCost: Number(stockItem.costPrice) || 0,
        stockOnHand: stockItem.quantityOnHand || 0,
        isCustom: false
      };
      return copy;
    });
  };

  // Update line item numeric / text fields
  const updateItemRow = (index, field, value) => {
    setItems(prev => {
      const copy = [...prev];
      if (field === 'itemName' || field === 'productSku') {
        copy[index][field] = value;
      } else {
        copy[index][field] = value === '' ? '' : Math.max(0, Number(value));
      }
      return copy;
    });
  };

  // Financial Calculations
  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unitCost) || 0)), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return Math.max(0, subtotal + Number(tax || 0) - Number(discount || 0));
  };

  // Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const finalVendorName = vendorName.trim();
    if (!finalVendorName) {
      setError('Please select or specify a Supplier / Vendor.');
      return;
    }

    if (items.length === 0) {
      setError('Purchase order must contain at least one order item.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.itemName.trim() && !item.productId) {
        setError(`Please select or enter an item name for row #${i + 1}.`);
        return;
      }
      if ((Number(item.quantity) || 0) <= 0) {
        setError(`Quantity for '${item.itemName || 'Item #' + (i + 1)}' must be at least 1.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const poPayload = {
        supplierId: supplierId ? Number(supplierId) : null,
        vendorName: finalVendorName,
        supplierName: finalVendorName,
        warehouseId: warehouseId ? Number(warehouseId) : null,
        expectedDateUtc: expectedDate ? new Date(expectedDate).toISOString() : null,
        paymentTerms: paymentTerms?.trim() || 'Net 30',
        tax: Number(tax) || 0,
        discount: Number(discount) || 0,
        notes: notes?.trim() || null,
        totalAmount: calculateTotal(),
        status: initialPO?.status || 'PENDING_APPROVAL',
        items: items.map(i => ({
          productId: i.productId ? Number(i.productId) : null,
          productSku: i.productSku || '',
          itemName: i.itemName,
          productName: i.itemName,
          quantity: Number(i.quantity) || 1,
          unitCost: Number(i.unitCost) || 0,
          unitPrice: Number(i.unitCost) || 0,
          discount: Number(i.discount) || 0,
          tax: Number(i.tax) || 0
        }))
      };

      await onSave(poPayload, initialPO?.id);
      onClose();
    } catch (err) {
      console.error('Save PO error:', err);
      setError(err?.response?.data?.message || (typeof err === 'string' ? err : err?.message) || 'Error saving purchase order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1976ab] via-[#2089C8] to-[#2899dd] px-6 py-5 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white">
                  {mode === 'edit' ? `Edit Purchase Order (${initialPO?.poNumber || initialPO?.orderNumber || (initialPO?.id ? 'PO-#' + initialPO.id : '')})` : 'New Purchase Order (PO)'}
                </h2>
                <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-md uppercase tracking-wider">
                  Inventory Linked
                </span>
              </div>
              <p className="text-xs text-sky-100/90 mt-0.5">
                Auto-populate item costs from inventory & select vendors directly from database
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

          {/* Top Info Grid: Supplier, Warehouse, Date, Payment Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
            {/* Vendor / Supplier */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-[#2089C8]" />
                <span>Supplier / Vendor</span>
              </label>
              {!isCustomSupplier && suppliers.length > 0 ? (
                <div className="relative">
                  <select
                    value={supplierId || ''}
                    onChange={handleSupplierChange}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8] appearance-none pr-8 cursor-pointer"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.supplierCode || 'SUP'})
                      </option>
                    ))}
                    <option value="CUSTOM">+ Other (Enter Custom Name)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    required
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="Enter supplier name..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                  />
                  {suppliers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomSupplier(false);
                        if (suppliers[0]) {
                          setSupplierId(suppliers[0].id);
                          setVendorName(suppliers[0].name);
                          if (suppliers[0].paymentTerms) setPaymentTerms(suppliers[0].paymentTerms);
                        }
                      }}
                      className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      title="Choose from list"
                    >
                      List
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Target Warehouse */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Warehouse className="w-3.5 h-3.5 text-[#2089C8]" />
                <span>Target Warehouse</span>
              </label>
              <div className="relative">
                <select
                  value={warehouseId || ''}
                  onChange={(e) => setWarehouseId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8] appearance-none pr-8 cursor-pointer"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                  {warehouses.length === 0 && (
                    <option value="">Main Warehouse (Default)</option>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Expected Delivery Date */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#2089C8]" />
                <span>Expected Date</span>
              </label>
              <input 
                type="date" 
                required 
                value={expectedDate} 
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]" 
              />
            </div>

            {/* Payment Terms */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#2089C8]" />
                <span>Payment Terms</span>
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
              >
                <option value="Net 30">Net 30 (30 Days)</option>
                <option value="Net 15">Net 15 (15 Days)</option>
                <option value="Net 60">Net 60 (60 Days)</option>
                <option value="Cash">Cash on Delivery (COD)</option>
                <option value="Immediate">Immediate / Advance</option>
              </select>
            </div>
          </div>

          {/* Order Line Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-[#2089C8]" />
                  <span>Order Line Items</span>
                </label>
                <span className="px-2 py-0.5 bg-sky-100 text-[#1976ab] text-xs font-bold rounded-full">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <button 
                type="button" 
                onClick={addItemRow}
                className="px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-[#2089C8] border border-sky-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {/* Line Items List */}
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {items.map((row, idx) => {
                const lineTotal = (Number(row.quantity) || 0) * (Number(row.unitCost) || 0);

                return (
                  <div 
                    key={idx} 
                    className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-[#2089C8]/40 transition-all space-y-2"
                  >
                    <div className="grid grid-cols-12 gap-3 items-center">
                      {/* Product Selector / Name */}
                      <div className="col-span-12 sm:col-span-6">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Select Product from Inventory
                        </label>
                        {!row.isCustom ? (
                          <SearchableItemSelect
                            items={stockCatalog}
                            value={row.productId || ''}
                            onChange={(val) => handleSelectInventoryItem(idx, val)}
                            allowCustom={true}
                            priceField="costPrice"
                            placeholder="Search by SKU or item name..."
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              required
                              value={row.itemName}
                              onChange={(e) => updateItemRow(idx, 'itemName', e.target.value)}
                              placeholder="Type item name..."
                              className="w-full px-3 py-2 bg-slate-50 border border-amber-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                            />
                            {stockCatalog.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleSelectInventoryItem(idx, stockCatalog[0]?.id)}
                                className="px-2 py-2 bg-sky-50 hover:bg-sky-100 text-[#2089C8] text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer border border-sky-200"
                                title="Pick from inventory"
                              >
                                Catalog
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-center">
                          Order Qty
                        </label>
                        <input 
                          type="number" 
                          min="1" 
                          required 
                          value={row.quantity === 0 || row.quantity === '' ? '' : row.quantity}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updateItemRow(idx, 'quantity', e.target.value)}
                          placeholder="1"
                          className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-center font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30" 
                        />
                      </div>

                      {/* Unit Cost Price (from Inventory) */}
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Unit Cost ($)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-slate-400 text-xs font-bold">$</span>
                          <input 
                            type="number" 
                            step="0.01" 
                            min="0" 
                            required 
                            value={row.unitCost === 0 || row.unitCost === '' ? '' : row.unitCost}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateItemRow(idx, 'unitCost', e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-6 pr-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30" 
                          />
                        </div>
                      </div>

                      {/* Line Subtotal & Delete */}
                      <div className="col-span-4 sm:col-span-2 flex items-center justify-between sm:justify-end gap-2 pt-4 sm:pt-0">
                        <div className="text-right">
                          <span className="block text-[9px] font-bold text-slate-400 uppercase">Subtotal</span>
                          <span className="text-xs font-mono font-extrabold text-slate-900">
                            ${lineTotal.toFixed(2)}
                          </span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => removeItemRow(idx)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer shrink-0"
                          title={items.length === 1 ? "Clear line item" : "Remove line item"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Stock Details Badge row */}
                    {row.productId && (
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <span className="font-mono font-semibold text-slate-600">
                          SKU: <strong className="text-slate-800">{row.productSku || 'N/A'}</strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                          Current In-Stock: <strong className="text-[#2089C8] font-bold">{row.stockOnHand} units</strong>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes & Summary Box Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            {/* Notes / Special Instructions */}
            <div className="md:col-span-6 space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Notes / Purchase Instructions
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Include QA certificate, deliver to dock A3, PO reference..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8] resize-none"
              />
            </div>

            {/* Financial Summary Box */}
            <div className="md:col-span-6 p-4 bg-gradient-to-br from-sky-50/90 to-slate-50 border border-sky-200/90 rounded-2xl space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                <span>Items Subtotal:</span>
                <span className="font-mono font-bold text-slate-800">${calculateSubtotal().toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-sky-100">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Order Tax ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tax === 0 || tax === '' ? '' : tax}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setTax(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    placeholder="0.00"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Discount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discount === 0 || discount === '' ? '' : discount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDiscount(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    placeholder="0.00"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-rose-700 focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-sky-200/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                  <Calculator className="w-4 h-4 text-[#2089C8]" />
                  <span>Total Amount:</span>
                </div>
                <span className="text-2xl font-black font-mono text-emerald-700 tracking-tight">
                  ${calculateTotal().toFixed(2)}
                </span>
              </div>
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
              className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer shadow-sm flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  <span>{mode === 'edit' ? 'Save Changes' : 'Create Purchase Order'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

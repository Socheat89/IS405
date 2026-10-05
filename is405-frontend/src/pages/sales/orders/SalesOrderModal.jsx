import React, { useState, useEffect } from 'react';
import { X, Tag, Plus, Trash2, Calculator, Calendar, User, Sparkles, DollarSign, Edit2, Package, ChevronDown, Warehouse, CheckCircle2 } from 'lucide-react';
import { stockItemService } from '../../../services/stock/stockItemService';
import { warehouseService } from '../../../services/stock/warehouseService';
import { salesService } from '../../../services/sales/salesService';
import { useToast } from '../../../context/ToastContext';
import { SearchableItemSelect } from '../../../components/common/SearchableItemSelect';

export const SalesOrderModal = ({ isOpen, onClose, onSave, initialSO = null, mode = 'create' }) => {
  const toast = useToast();

  const [customerName, setCustomerName] = useState(initialSO?.customerName || 'Angkor Tech Solutions');
  const [warehouseId, setWarehouseId] = useState(initialSO?.warehouseId || '');
  const [warehouses, setWarehouses] = useState([]);
  const [deliveryDate, setDeliveryDate] = useState(
    initialSO?.deliveryDate || 
    (initialSO?.saleDateUtc ? initialSO.saleDateUtc.substring(0, 10) : '') || 
    new Date().toISOString().substring(0, 10)
  );
  const [items, setItems] = useState([]);
  const [stockCatalog, setStockCatalog] = useState([]);
  const [warehouseStockMap, setWarehouseStockMap] = useState({});
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load Inventory items & Warehouses & initialize state
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const loadPrerequisites = async () => {
      setLoadingData(true);
      setError('');
      try {
        const [catalogData, whList] = await Promise.all([
          stockItemService.getItems().catch(() => []),
          warehouseService.getWarehouses(true).catch(() => [])
        ]);

        if (!isMounted) return;
        const catalog = Array.isArray(catalogData) ? catalogData : [];
        const whs = Array.isArray(whList) ? whList : [];
        setStockCatalog(catalog);
        setWarehouses(whs);

        if (initialSO && mode === 'edit') {
          setCustomerName(initialSO.customerName || '');
          setWarehouseId(initialSO.warehouseId || (whs.length > 0 ? whs[0].id : ''));
          setDeliveryDate(
            initialSO.deliveryDate || 
            (initialSO.saleDateUtc ? initialSO.saleDateUtc.substring(0, 10) : '') || 
            new Date().toISOString().substring(0, 10)
          );

          if (initialSO.items && initialSO.items.length > 0) {
            setItems(initialSO.items.map(it => {
              const matchedItem = catalog.find(c => 
                c.id === (it.productId || it.itemId) || 
                (it.productSku && c.sku?.toLowerCase() === it.productSku?.toLowerCase()) || 
                (it.productName && c.name?.toLowerCase() === it.productName?.toLowerCase())
              );
              return {
                productId: it.productId || it.itemId || (matchedItem ? matchedItem.id : (catalog[0]?.id || null)),
                productSku: it.productSku || it.sku || (matchedItem ? matchedItem.sku : (catalog[0]?.sku || '')),
                itemName: it.productName || it.itemName || it.name || it.itemDescription || (matchedItem ? matchedItem.name : (catalog[0]?.name || '')),
                quantity: it.quantity !== undefined ? it.quantity : 1,
                unitPrice: it.unitPrice !== undefined ? it.unitPrice : (matchedItem ? Number(matchedItem.sellingPrice || matchedItem.unitPrice || 0) : 0),
                isCustom: false
              };
            }));
          } else if (catalog.length > 0) {
            const first = catalog[0];
            setItems([{ productId: first.id, productSku: first.sku, itemName: first.name, quantity: 1, unitPrice: Number(first.sellingPrice || 0), isCustom: false }]);
          } else {
            setItems([]);
          }
        } else {
          setCustomerName('Angkor Tech Solutions');
          const defaultWhId = whs.length > 0 ? whs[0].id : '';
          setWarehouseId(defaultWhId);
          setDeliveryDate(new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10));
          if (catalog.length > 0) {
            const first = catalog[0];
            setItems([{
              productId: first.id,
              productSku: first.sku,
              itemName: first.name,
              quantity: 1,
              unitPrice: Number(first.sellingPrice || first.unitPrice || first.costPrice || 0),
              isCustom: false
            }]);
          } else {
            setItems([]);
          }
        }
      } catch (err) {
        console.error('Error loading sales order catalog:', err);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    };

    loadPrerequisites();
    return () => { isMounted = false; };
  }, [initialSO, mode, isOpen]);

  // Load live stock for selected warehouse
  useEffect(() => {
    if (!isOpen || !warehouseId) {
      setWarehouseStockMap({});
      return;
    }
    let isMounted = true;
    const fetchWhStocks = async () => {
      setLoadingStocks(true);
      try {
        const stocks = await warehouseService.getWarehouseStocks({ warehouseId: Number(warehouseId), pageSize: 1000 });
        if (!isMounted) return;
        const map = {};
        if (Array.isArray(stocks)) {
          stocks.forEach(s => {
            const pId = s.productId || s.itemId;
            if (pId) {
              map[pId] = Number(s.quantityOnHand ?? s.quantity ?? 0);
            }
          });
        }
        setWarehouseStockMap(map);
      } catch (err) {
        console.warn('Failed to fetch warehouse stocks:', err);
      } finally {
        if (isMounted) setLoadingStocks(false);
      }
    };

    fetchWhStocks();
    return () => { isMounted = false; };
  }, [warehouseId, isOpen]);

  const addItemRow = () => {
    if (stockCatalog.length > 0) {
      const first = stockCatalog[0];
      setItems(prev => [...prev, {
        productId: first.id,
        productSku: first.sku,
        itemName: first.name,
        quantity: 1,
        unitPrice: Number(first.sellingPrice || first.unitPrice || first.costPrice || 0),
        isCustom: false
      }]);
    } else {
      setItems(prev => [...prev, { productId: null, productSku: '', itemName: '', quantity: 1, unitPrice: '', isCustom: false }]);
    }
  };

  const removeItemRow = (index) => {
    if (items.length <= 1) {
      if (stockCatalog.length > 0) {
        const first = stockCatalog[0];
        setItems([{ productId: first.id, productSku: first.sku, itemName: first.name, quantity: 1, unitPrice: Number(first.sellingPrice || 0), isCustom: false }]);
      }
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectCatalogItem = (index, selectedId) => {
    if (selectedId === 'CUSTOM') {
      setItems(prev => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          productId: null,
          productSku: '',
          itemName: '',
          unitPrice: '',
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
        unitPrice: Number(stockItem.sellingPrice || stockItem.unitPrice || stockItem.costPrice || 0),
        isCustom: false
      };
      return copy;
    });
  };

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

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), 0);
  };

  const handleFormSubmit = async (autoConfirm = false) => {
    setError('');
    if (!customerName.trim() || items.length === 0) {
      setError('Please enter customer name and at least one order item.');
      return;
    }

    if (!warehouseId) {
      setError('Please select a designated warehouse to fulfill and dispatch this order.');
      return;
    }

    const selectedWh = warehouses.find(w => String(w.id) === String(warehouseId));
    const whName = selectedWh?.name || 'Selected Warehouse';

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId) {
        setError(`Please select a valid item from the catalog for row #${i + 1}.`);
        return;
      }
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) {
        setError(`Quantity for item #${i + 1} must be greater than 0.`);
        return;
      }

      const avail = warehouseStockMap[item.productId] ?? 0;
      if (autoConfirm && qty > avail) {
        setError(`Cannot confirm order: Product "${item.itemName}" only has ${avail} available unit(s) in warehouse "${whName}", but ${qty} was requested. You cannot confirm an order without sufficient stock!`);
        return;
      }
    }

    setSubmitting(true);
    const payload = {
      customerName: customerName.trim(),
      warehouseId: warehouseId ? Number(warehouseId) : null,
      deliveryDate,
      totalAmount: calculateSubtotal(),
      autoConfirm: autoConfirm,
      status: autoConfirm ? 'CONFIRMED' : (initialSO?.status || 'QUOTATION'),
      items: items.map(i => ({
        productId: i.productId ? Number(i.productId) : null,
        productSku: i.productSku || null,
        productName: i.itemName,
        itemName: i.itemName,
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.unitPrice) || 0,
        discount: 0,
        tax: 0
      }))
    };

    try {
      if (typeof onSave === 'function') {
        await onSave(payload, initialSO?.id);
      } else {
        if (mode === 'edit' && initialSO?.id) {
          await salesService.updateSalesOrder(initialSO.id, payload);
          toast?.success?.('Sales order updated successfully');
        } else {
          const res = await salesService.createSalesOrder(payload);
          if (autoConfirm) {
            toast?.success?.(`Sales order ${res?.invoiceNumber || ''} confirmed! Awaiting dispatch in Stock Module.`);
          } else {
            toast?.success?.(`Sales Quotation ${res?.invoiceNumber || ''} saved as draft`);
          }
        }
      }
      if (typeof onClose === 'function') {
        onClose();
      }
    } catch (err) {
      console.error('SalesOrderModal submit error:', err);
      let msg = typeof err === 'string' 
        ? err 
        : err?.response?.data?.message || err?.message || 'Error saving sales order';
      if (typeof msg !== 'string') {
        msg = 'Error saving sales order';
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const orderIdentifier = initialSO?.invoiceNumber || initialSO?.orderNumber || initialSO?.soNumber || (initialSO?.id ? `SO-#${initialSO.id}` : '');

  if (!isOpen) return null;

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
                {mode === 'edit' ? `Edit Sales Order (${orderIdentifier})` : 'New Sales Order'}
              </h2>
              <p className="text-xs text-sky-100/90 mt-0.5">
                {mode === 'edit' ? 'Update customer information, prices, and line items' : 'Create quotation or sell directly with instant Stock OUT'}
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
        <div className="p-6 overflow-y-auto space-y-5">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
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
                <Warehouse className="w-3.5 h-3.5 text-slate-400" />
                <span>Warehouse</span>
              </label>
              <div className="relative">
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8] cursor-pointer appearance-none pr-8"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Delivery Date</span>
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
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-[#2089C8]" />
                <span>Order Lines</span>
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

            <div className="space-y-2.5">
              {items.map((item, index) => (
                <div key={index} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    {/* Catalog Item / Description */}
                    <div className="col-span-12 sm:col-span-6">
                      <SearchableItemSelect
                        items={stockCatalog}
                        value={item.productId || ''}
                        onChange={(val) => handleSelectCatalogItem(index, val)}
                        allowCustom={false}
                        priceField="sellingPrice"
                        placeholder="Search by SKU or item name..."
                      />

                      {item.productId && (
                        <div className="mt-1 flex items-center gap-1.5">
                          {loadingStocks ? (
                            <span className="text-[10px] text-slate-400 animate-pulse">Checking warehouse stock...</span>
                          ) : (
                            (() => {
                              const avail = warehouseStockMap[item.productId] ?? 0;
                              const requested = Number(item.quantity) || 0;
                              const whObj = warehouses.find(w => String(w.id) === String(warehouseId));
                              const whName = whObj?.name || 'Warehouse';
                              if (avail <= 0) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                    Out of stock (0 units in {whName})
                                  </span>
                                );
                              }
                              if (avail < requested) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    Low stock: only {avail} in {whName} (Order: {requested})
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  In Stock: {avail} available in {whName}
                                </span>
                              );
                            })()
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="col-span-5 sm:col-span-2">
                      <input
                        type="number"
                        required
                        min="1"
                        value={item.quantity === 0 || item.quantity === '' ? '' : item.quantity}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateItemRow(index, 'quantity', e.target.value)}
                        placeholder="Qty"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30"
                      />
                    </div>

                    {/* Unit Price ($) */}
                    <div className="col-span-5 sm:col-span-3">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-mono">$</span>
                        <input
                          type="number"
                          required
                          step="0.01"
                          min="0"
                          value={item.unitPrice === 0 || item.unitPrice === '' ? '' : item.unitPrice}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updateItemRow(index, 'unitPrice', e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30"
                        />
                      </div>
                    </div>

                    {/* Delete / Clear Row */}
                    <div className="col-span-2 sm:col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeItemRow(index)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                        title={items.length === 1 ? "Clear / Reset item" : "Remove item"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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

            {mode === 'edit' ? (
              <button
                type="button"
                onClick={() => handleFormSubmit(false)}
                disabled={submitting}
                className="btn-primary px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleFormSubmit(false)}
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors border border-slate-300"
                  title="Save order as draft quotation without deducting stock"
                >
                  Save as Quotation (Draft)
                </button>

                <button
                  type="button"
                  onClick={() => handleFormSubmit(true)}
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm flex items-center gap-1.5 transition-colors"
                  title="Validate stock and confirm sales order for warehouse dispatch"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Validating & Confirming...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Sales Order</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Package, Check, X, Sparkles } from 'lucide-react';

/**
 * Reusable Searchable Product/Item Select Dropdown
 * 
 * Props:
 * - items: Array of catalog items [{ id, name, sku, quantityOnHand, stockOnHand, sellingPrice, unitPrice, costPrice, unitCost }]
 * - value: Selected item id (number or string) or 'CUSTOM'
 * - onChange: (selectedId, selectedItemObj) => void
 * - placeholder: Search placeholder text
 * - allowCustom: Boolean to allow selecting/typing custom item
 * - priceField: 'sellingPrice' | 'costPrice' | 'unitCost'
 * - disabled: Boolean
 */
export const SearchableItemSelect = ({
  items = [],
  value = '',
  onChange,
  placeholder = 'Search by SKU or item name...',
  allowCustom = true,
  priceField = 'sellingPrice',
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Find currently selected item
  const selectedItem = items.find(i => String(i.id) === String(value));
  const isCustomSelected = value === 'CUSTOM' || (!selectedItem && Boolean(value));

  // Filter items based on search term
  const filteredItems = items.filter(item => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const nameMatch = (item.name || '').toLowerCase().includes(term);
    const skuMatch = (item.sku || '').toLowerCase().includes(term);
    const barcodeMatch = (item.barcode || '').toLowerCase().includes(term);
    return nameMatch || skuMatch || barcodeMatch;
  });

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleSelect = (itemId, itemObj = null) => {
    if (onChange) {
      onChange(itemId, itemObj);
    }
    setIsOpen(false);
  };

  const getItemPrice = (item) => {
    if (priceField === 'costPrice' || priceField === 'unitCost') {
      return Number(item.costPrice ?? item.unitCost ?? item.unitPrice ?? 0);
    }
    return Number(item.sellingPrice ?? item.unitPrice ?? item.costPrice ?? 0);
  };

  const getStockQty = (item) => {
    return Number(item.quantityOnHand ?? item.stockOnHand ?? item.qtyOnHand ?? 0);
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Selected Value Trigger Box */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full text-left px-3 py-2 bg-white border rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs ${
          isOpen 
            ? 'border-[#2089C8] ring-2 ring-[#2089C8]/20 bg-sky-50/20' 
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Package className="w-3.5 h-3.5 text-[#2089C8] shrink-0" />
          {selectedItem ? (
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              {selectedItem.sku && (
                <span className="font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                  {selectedItem.sku}
                </span>
              )}
              <span className="font-bold text-slate-800 truncate">{selectedItem.name}</span>
              <span className="text-[11px] font-mono text-emerald-600 font-bold shrink-0 ml-auto mr-1">
                ${getItemPrice(selectedItem).toFixed(2)}
              </span>
            </div>
          ) : isCustomSelected ? (
            <span className="text-amber-700 font-bold text-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Custom / Non-Catalog Item</span>
            </span>
          ) : (
            <span className="text-slate-400 font-medium">{placeholder}</span>
          )}
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#2089C8]' : ''}`} />
      </button>

      {/* Dropdown Menu Box */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-72">
          {/* Search Header Input */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-10 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search SKU or item name..."
              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#2089C8]"
              onClick={(e) => e.stopPropagation()}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* List of Items */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100/60 p-1">
            {allowCustom && (
              <button
                type="button"
                onClick={() => handleSelect('CUSTOM', null)}
                className={`w-full px-3 py-2 text-left rounded-xl text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  value === 'CUSTOM' ? 'bg-amber-50 text-amber-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px]">
                    +
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Custom / Non-Catalog Item</p>
                    <p className="text-[10px] text-slate-400">Enter item name manually</p>
                  </div>
                </div>
                {value === 'CUSTOM' && <Check className="w-3.5 h-3.5 text-amber-600" />}
              </button>
            )}

            {filteredItems.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                No items found matching "{searchTerm}"
              </div>
            ) : (
              filteredItems.map(item => {
                const isSelected = String(item.id) === String(value);
                const stock = getStockQty(item);
                const price = getItemPrice(item);
                const isLow = stock > 0 && stock <= (item.minStockLevel || 10);
                const isOut = stock <= 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id, item)}
                    className={`w-full px-3 py-2 text-left rounded-xl text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected 
                        ? 'bg-sky-50 text-[#2089C8] font-bold' 
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                        {item.sku || 'N/A'}
                      </div>
                      <div className="min-w-0 flex-1 truncate">
                        <p className="font-bold text-slate-800 truncate">{item.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>
                            Stock: <strong className={isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-emerald-700'}>
                              {stock} {item.unit || 'PCS'}
                            </strong>
                          </span>
                          {item.location && <span>• {item.location}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        ${price.toFixed(2)}
                      </span>
                    </div>

                    {isSelected && <Check className="w-3.5 h-3.5 text-[#2089C8] shrink-0 ml-1" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

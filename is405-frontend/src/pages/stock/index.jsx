// Stock Module Root — Tab router for Items / Stock-In / Stock-Out / Stock Transfers / Warehouses
import React, { useState } from 'react';
import { Package, ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Building2 } from 'lucide-react';
import { StockItemsPage } from './items/StockItemsPage';
import { StockInPage }    from './stock-in/StockInPage';
import { StockOutPage }   from './stock-out/StockOutPage';
import { StockTransfersPage } from './transfers/StockTransfersPage';
import { WarehousesPage } from './warehouses/WarehousesPage';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { id: 'items',       label: 'Stock Items',           icon: Package,          color: 'text-emerald-600', perm: 'stock-items.view' },
  { id: 'stock-in',    label: 'Stock In (PO)',         icon: ArrowDownToLine,  color: 'text-blue-600',    perm: 'stock-in.view'    },
  { id: 'stock-out',   label: 'Stock Out (Sales)',     icon: ArrowUpFromLine,  color: 'text-rose-600',    perm: 'stock-out.view'   },
  { id: 'transfers',   label: 'Stock Transfers (Multi-WH)', icon: ArrowRightLeft, color: 'text-purple-600',  perm: 'transfers.view'   },
  { id: 'warehouses',  label: 'Warehouses',            icon: Building2,        color: 'text-amber-600',   perm: 'warehouses.view'  },
];

export const StockModule = ({ onNavigateApp }) => {
  const { hasPermission, user } = useAuth();

  const accessibleTabs = TABS.filter(t =>
    user?.isAdmin || hasPermission(t.perm)
  );

  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('is405_stock_tab');
    if (saved && accessibleTabs.some(t => t.id === saved)) return saved;
    return accessibleTabs[0]?.id || '';
  });

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem('is405_stock_tab', tabId);
  };

  const currentTab = accessibleTabs.some(t => t.id === activeTab)
    ? activeTab
    : (accessibleTabs[0]?.id || '');

  if (accessibleTabs.length === 0) {
    return (
      <div className="min-h-full flex items-center justify-center p-12">
        <div className="text-center max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">No Stock Sub-Modules Authorized</h3>
          <p className="text-xs text-slate-500 mt-1">
            You have not been granted access to any stock tabs. Please contact your system administrator to assign permissions (e.g. Stock Items, Stock In, Stock Out, Stock Transfers, Warehouses).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      {/* Module Tab Bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 pt-3">
        <div className="flex items-center gap-1.5 w-full max-w-[1600px] mx-auto overflow-x-auto">
          {accessibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? `border-[#2089C8] text-[#2089C8] bg-sky-50/70`
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#2089C8]' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Content */}
      <div className="flex-1">
        {currentTab === 'items'      && <StockItemsPage />}
        {currentTab === 'stock-in'   && <StockInPage onNavigateToPo={() => onNavigateApp && onNavigateApp('po')} />}
        {currentTab === 'stock-out'  && <StockOutPage onNavigateToSales={() => onNavigateApp && onNavigateApp('sales')} />}
        {currentTab === 'transfers'  && <StockTransfersPage />}
        {currentTab === 'warehouses' && <WarehousesPage />}
      </div>
    </div>
  );
};

// Purchase Orders Module Root — sub-module router
import React, { useState } from 'react';
import { ShoppingBag, PackageCheck, BarChart3 } from 'lucide-react';
import { PurchaseOrdersPage } from './orders/PurchaseOrdersPage';
import { PurchaseReportsPage } from './reports/PurchaseReportsPage';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { id: 'orders',   label: 'Purchase Orders', icon: ShoppingBag,  perm: 'purchase-orders.view' },
  { id: 'receipts', label: 'Goods Receipts',  icon: PackageCheck, perm: 'goods-receipts.view'  },
  { id: 'reports',  label: 'Purchasing Reports', icon: BarChart3, perm: 'purchases.view'      },
];

export const PurchaseModule = () => {
  const { hasPermission, user } = useAuth();

  const accessibleTabs = TABS.filter(t =>
    user?.isAdmin || hasPermission(t.perm) || hasPermission('purchases.view')
  );

  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('is405_po_tab');
    if (saved && accessibleTabs.some(t => t.id === saved)) return saved;
    return accessibleTabs[0]?.id || '';
  });

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem('is405_po_tab', tabId);
  };

  const currentTab = accessibleTabs.some(t => t.id === activeTab)
    ? activeTab
    : (accessibleTabs[0]?.id || '');

  if (accessibleTabs.length === 0) {
    return (
      <div className="min-h-full flex items-center justify-center p-12">
        <div className="text-center max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">No Purchasing Sub-Modules Authorized</h3>
          <p className="text-xs text-slate-500 mt-1">
            You do not have permission to access purchase orders or goods receipts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      {/* Module Tab Bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 pt-3">
        <div className="flex items-center gap-1.5 w-full max-w-[1600px] mx-auto">
          {accessibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-[#2089C8] text-[#2089C8] bg-sky-50/70'
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
        {currentTab === 'orders' && <PurchaseOrdersPage />}
        {currentTab === 'receipts' && (
          <div className="p-12 text-center text-slate-400">
            <PackageCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-slate-600">Goods Receipts</p>
            <p className="text-xs mt-1">Coming soon — link to Stock In records</p>
          </div>
        )}
        {currentTab === 'reports' && <PurchaseReportsPage />}
      </div>
    </div>
  );
};

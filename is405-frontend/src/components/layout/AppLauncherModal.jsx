import React, { useMemo } from 'react';
import { Package, ShoppingBag, Tag, Users, ShieldCheck, LayoutDashboard, Layers, Settings, X, ChevronRight, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ALL_APPS = [
  { id: 'dashboard', name: 'Dashboard',          subtitle: 'Overview & System Metrics',      icon: LayoutDashboard, iconClass: 'icon-wrap-indigo',  badge: 'Home',     badgeClass: 'badge-indigo'  },
  { id: 'stock',     name: 'Stock Management',   subtitle: 'Inventory & Warehouses',          icon: Package,         iconClass: 'icon-wrap-emerald', badge: 'Module',   badgeClass: 'badge-emerald' },
  { id: 'po',        name: 'Purchase Orders',    subtitle: 'Vendor Purchase Orders',          icon: ShoppingBag,     iconClass: 'icon-wrap-purple',  badge: 'Module',   badgeClass: 'badge-purple'  },
  { id: 'sales',     name: 'Sales Orders',       subtitle: 'Quotations & Delivery',           icon: Tag,             iconClass: 'icon-wrap-blue',    badge: 'Module',   badgeClass: 'badge-blue'    },
  { id: 'users',     name: 'User Management',    subtitle: 'Accounts & Access Control',       icon: Users,           iconClass: 'icon-wrap-teal',    badge: 'Admin',    badgeClass: 'badge-teal'    },
  { id: 'roles',     name: 'Roles & Permissions',subtitle: 'Permissions Matrix',              icon: Layers,          iconClass: 'icon-wrap-amber',   badge: 'Admin',    badgeClass: 'badge-amber'   },
  { id: 'settings',  name: 'Admin Settings',     subtitle: 'System Configuration',            icon: Settings,        iconClass: 'icon-wrap-slate',   badge: 'Admin',    badgeClass: 'badge-slate'   },
];

export const AppLauncherModal = ({ isOpen, onClose, activeApp, setActiveApp }) => {
  const { canAccessApp, permissions } = useAuth();

  // Re-filter whenever permissions change (real-time)
  const appsList = useMemo(
    () => ALL_APPS.filter((app) => canAccessApp(app.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [permissions, canAccessApp]
  );

  if (!isOpen) return null;

  const handleSelect = (appId) => { 
    setActiveApp(appId); 
    onClose(); 
  };

  return (
    <div className="erp-modal-overlay animate-fade-in" onClick={onClose}>
      <div className="erp-modal w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1976ab] to-[#2089C8] px-8 py-5 text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute -top-8 -left-8 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
          <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-11 h-11 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20">
              <Zap className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Mekong Stock — App Launcher</h2>
              <p className="text-xs text-sky-100 mt-0.5 font-medium">Select Microservice Module</p>
            </div>
          </div>
          <button onClick={onClose} className="relative z-10 w-9 h-9 flex items-center justify-center hover:bg-white/15 rounded-xl transition-colors text-white/80 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* App Grid */}
        <div className="p-6 bg-slate-50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {appsList.map((app) => {
              const Icon = app.icon;
              const isCurrent = activeApp === app.id;

              return (
                <button 
                  key={app.id} 
                  onClick={() => handleSelect(app.id)} 
                  className={`app-card ${isCurrent ? 'active' : ''} group bg-white border border-slate-200 hover:border-[#2089C8] hover:shadow-md transition-all`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`icon-wrap icon-wrap-md ${app.iconClass} group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`badge ${app.badgeClass}`}>
                      {app.badge}
                    </span>
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-[#2089C8] transition-colors leading-tight">{app.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{app.subtitle}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold text-[#1976ab] border-t border-slate-100 pt-2.5 mt-auto">
                    <span className="text-[11px]">
                      {isCurrent ? 'Active Now' : 'Open'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-100 px-8 py-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="status-dot online bg-[#2089C8]" />
            Decoupled Microservices Architecture
          </span>
          <span className="text-[11px] font-mono text-slate-400">Mekong Stock v2.0</span>
        </div>
      </div>
    </div>
  );
};

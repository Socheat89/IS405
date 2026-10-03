import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, ShieldAlert, Clock, Truck, Sparkles } from 'lucide-react';

export const StatusBadge = ({ status, type = 'stock', size = 'sm' }) => {
  const sizeClasses = size === 'xs' 
    ? 'text-[10px] px-2 py-0.5 gap-1' 
    : size === 'md' 
    ? 'text-xs px-3 py-1 gap-1.5' 
    : 'text-[11px] px-2.5 py-0.5 gap-1.5';

  if (type === 'stock') {
    const s = (status || '').toUpperCase().replace(/_/g, '');
    switch (s) {
      case 'INSTOCK':
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shadow-xs ${sizeClasses}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20"></span>
            <span>In Stock</span>
          </span>
        );
      case 'LOWSTOCK':
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shadow-xs ${sizeClasses}`}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
            </span>
            <span>Low Stock</span>
          </span>
        );
      case 'OUTOFSTOCK':
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 shadow-xs ${sizeClasses}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            <span>Out of Stock</span>
          </span>
        );
      default:
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}>
            {status}
          </span>
        );
    }
  }

  if (type === 'boolean' || type === 'user') {
    return status ? (
      <span className={`inline-flex items-center font-medium rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 shadow-xs ${sizeClasses}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span>Active</span>
      </span>
    ) : (
      <span className={`inline-flex items-center font-medium rounded-full bg-slate-500/10 text-slate-600 border border-slate-300 shadow-xs ${sizeClasses}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
        <span>Inactive</span>
      </span>
    );
  }

  if (type === '2fa') {
    return status ? (
      <span className={`inline-flex items-center font-medium rounded-full bg-sky-50 text-[#155e89] border border-sky-200 shadow-2xs ${sizeClasses}`}>
        <ShieldCheck className="w-3.5 h-3.5 text-[#2089C8] shrink-0" />
        <span>2FA Enabled</span>
      </span>
    ) : (
      <span className={`inline-flex items-center font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs ${sizeClasses}`}>
        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>2FA Disabled</span>
      </span>
    );
  }

  if (type === 'sales') {
    switch (status) {
      case 'QUOTATION':
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-amber-500/10 text-amber-800 border border-amber-300 shadow-xs ${sizeClasses}`}>
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Quotation</span>
          </span>
        );
      case 'SALES_ORDER':
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-blue-500/10 text-blue-700 border border-blue-300 shadow-xs ${sizeClasses}`}>
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            <span>Sales Order</span>
          </span>
        );
      case 'DELIVERED':
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-300 shadow-xs ${sizeClasses}`}>
            <Truck className="w-3 h-3 text-emerald-600" />
            <span>Delivered</span>
          </span>
        );
      default:
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}>
            {status}
          </span>
        );
    }
  }

  return (
    <span className={`inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}>
      {status}
    </span>
  );
};

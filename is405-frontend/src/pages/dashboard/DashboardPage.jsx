import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, ShoppingBag, Tag, Users, ShieldCheck, Layers, ArrowUpRight, 
  CheckCircle, Activity, TrendingUp, Clock, BarChart3, Zap, Sparkles,
  Building2, Radio, QrCode, ArrowRightLeft, Cpu, Shield, Settings
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const HIGHLIGHTS = [
  '⚡ Multi-Warehouse Inventory & Real-time Stock Transfers',
  '📦 Vendor Purchase Orders & Goods Receipts Inspection (GRN)',
  '🛍️ Sales Invoicing, Credit Terms & Bakong KHQR Settlements',
  '🔒 Strict 2FA TOTP Protection & Decoupled Microservices Architecture'
];

const TYPEWRITER_PHRASES = [
  'Mekong Stock Microservices ERP',
  'Real-time Inventory & Multi-Warehouse Sync',
  'Automated Purchase Orders & GRN Receiving',
  'Instant Bakong KHQR Sales Settlement',
  'Strict 2FA TOTP Security & Access Control'
];

const TICKER_ITEMS = [
  { icon: '🔴', text: 'LIVE INVENTORY SYNC ACTIVE', highlight: true },
  { icon: '📦', text: 'Stock Items: 169 SKUs Cataloged', highlight: false },
  { icon: '🏢', text: 'Warehouses: Phnom Penh · Siem Reap · Battambang', highlight: false },
  { icon: '🛡️', text: '2FA TOTP Enforced & Secured', highlight: true },
  { icon: '🚀', text: 'Microservices Uptime: 99.9% Operational', highlight: false },
  { icon: '💳', text: 'Bakong KHQR Instant Settlement Ready', highlight: false },
  { icon: '🔄', text: 'Real-time Stock Movements Ledger Updated', highlight: false },
];

export const DashboardPage = ({ setActiveApp, onOpenLauncher }) => {
  const { canAccessApp, permissions, user } = useAuth();
  const [highlightIndex, setHighlightIndex] = useState(0);

  // Typewriter Animation State
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Typewriter effect logic
  useEffect(() => {
    const currentPhrase = TYPEWRITER_PHRASES[phraseIndex];
    let timeout;

    if (!isDeleting && typedText === currentPhrase) {
      // Finished typing full phrase, wait before deleting
      timeout = setTimeout(() => setIsDeleting(true), 2200);
    } else if (isDeleting && typedText === '') {
      // Finished deleting, move to next phrase
      setIsDeleting(false);
      setPhraseIndex((prev) => (prev + 1) % TYPEWRITER_PHRASES.length);
      timeout = setTimeout(() => {}, 350);
    } else {
      // Typing or deleting next character
      const speed = isDeleting ? 30 : 65;
      timeout = setTimeout(() => {
        setTypedText((prev) =>
          isDeleting
            ? currentPhrase.substring(0, prev.length - 1)
            : currentPhrase.substring(0, prev.length + 1)
        );
      }, speed);
    }

    return () => clearTimeout(timeout);
  }, [typedText, isDeleting, phraseIndex]);

  // Rotate hero highlight headline every 3.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setHighlightIndex((prev) => (prev + 1) % HIGHLIGHTS.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const allMetrics = [
    {
      id: 'stock',
      label: 'Stock Items',
      value: '169',
      unit: 'Items',
      color: 'emerald',
      icon: Package,
      status: 'Stock OK',
      statusIcon: CheckCircle,
      statusColor: 'text-emerald-600',
      action: 'stock',
      actionLabel: 'View Stock',
    },
    {
      id: 'po',
      label: 'Purchase Orders',
      value: '$41,920',
      unit: null,
      color: 'indigo',
      icon: ShoppingBag,
      status: '3 Pending',
      statusIcon: Clock,
      statusColor: 'text-indigo-600',
      action: 'po',
      actionLabel: 'View PO',
    },
    {
      id: 'sales',
      label: 'Sales Orders',
      value: '$23,587',
      unit: null,
      color: 'blue',
      icon: Tag,
      status: 'Quotations Active',
      statusIcon: TrendingUp,
      statusColor: 'text-blue-600',
      action: 'sales',
      actionLabel: 'View Sales',
    },
    {
      id: 'users',
      label: 'User Accounts',
      value: 'Active',
      unit: null,
      color: 'teal',
      icon: Users,
      status: 'Access Managed',
      statusIcon: CheckCircle,
      statusColor: 'text-teal-600',
      action: 'users',
      actionLabel: 'Manage Users',
    },
    {
      id: 'roles',
      label: 'Role Matrix',
      value: 'Configured',
      unit: null,
      color: 'amber',
      icon: Layers,
      status: 'RBAC Active',
      statusIcon: Shield,
      statusColor: 'text-amber-600',
      action: 'roles',
      actionLabel: 'Configure Roles',
    },
    {
      id: 'security',
      label: '2FA Compliance',
      value: '100%',
      unit: null,
      color: 'teal',
      icon: ShieldCheck,
      status: 'All Secured',
      statusIcon: ShieldCheck,
      statusColor: 'text-teal-600',
      action: 'security',
      actionLabel: 'Security Hub',
    },
  ];

  const accessibleMetrics = useMemo(() => {
    const list = allMetrics.filter((m) => canAccessApp(m.action));
    // If user has 3 or fewer metrics, always include 2FA compliance metric as standard security card
    if (list.length === 0) {
      return allMetrics.filter((m) => m.action === 'security');
    }
    return list;
  }, [permissions, canAccessApp]);

  const ALL_MODULES = [
    {
      id: 'stock',
      icon: Package,
      iconClass: 'icon-wrap-emerald',
      badge: 'Stock Module',
      badgeClass: 'badge-emerald',
      color: 'emerald',
      title: 'Stock Management',
      desc: 'Manage inventory list, warehouse stocks, update quantities, and monitor low-stock items.',
      btnClass: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200',
      hoverBorder: 'hover:border-emerald-300',
    },
    {
      id: 'po',
      icon: ShoppingBag,
      iconClass: 'icon-wrap-purple',
      badge: 'Purchase Module',
      badgeClass: 'badge-purple',
      color: 'purple',
      title: 'Purchase Orders — PO',
      desc: 'Manage vendor purchase orders, create POs, track delivery schedules, and receive incoming goods.',
      btnClass: 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200',
      hoverBorder: 'hover:border-purple-300',
    },
    {
      id: 'sales',
      icon: Tag,
      iconClass: 'icon-wrap-blue',
      badge: 'Sales Module',
      badgeClass: 'badge-blue',
      color: 'blue',
      title: 'Sales Orders',
      desc: 'Manage customer sales, generate price quotations, and track order deliveries.',
      btnClass: 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200',
      hoverBorder: 'hover:border-blue-300',
    },
    {
      id: 'users',
      icon: Users,
      iconClass: 'icon-wrap-teal',
      badge: 'Admin Module',
      badgeClass: 'badge-teal',
      color: 'teal',
      title: 'User Management',
      desc: 'Manage system accounts, user status, passwords, and assigned system roles.',
      btnClass: 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200',
      hoverBorder: 'hover:border-teal-300',
    },
    {
      id: 'roles',
      icon: Layers,
      iconClass: 'icon-wrap-amber',
      badge: 'Admin Module',
      badgeClass: 'badge-amber',
      color: 'amber',
      title: 'Roles & Permissions',
      desc: 'Define role hierarchy, fine-grained access control permissions, and user assignments.',
      btnClass: 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200',
      hoverBorder: 'hover:border-amber-300',
    },
    {
      id: 'settings',
      icon: Settings,
      iconClass: 'icon-wrap-slate',
      badge: 'Admin Module',
      badgeClass: 'badge-slate',
      color: 'slate',
      title: 'System Settings',
      desc: 'Configure business profile, multi-currency rates, email notifications, and system backups.',
      btnClass: 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200',
      hoverBorder: 'hover:border-slate-300',
    },
    {
      id: 'security',
      icon: ShieldCheck,
      iconClass: 'icon-wrap-indigo',
      badge: 'Security Module',
      badgeClass: 'badge-indigo',
      color: 'indigo',
      title: 'Security & 2FA Hub',
      desc: 'Manage two-factor authentication, TOTP QR setup, and session security protections.',
      btnClass: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200',
      hoverBorder: 'hover:border-indigo-300',
    },
  ];

  const accessibleModules = useMemo(() => {
    return ALL_MODULES.filter((m) => canAccessApp(m.id));
  }, [permissions, canAccessApp]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-8 bg-grid-pattern min-h-full pb-16">

      {/* ════════════════════ HERO BANNER WITH ANIMATED RUNNING MARQUEE & TYPEWRITER ════════════════════ */}
      <div className="text-white shadow-2xl rounded-3xl relative overflow-hidden bg-gradient-to-r from-[#124d70] via-[#155e89] to-[#2089C8] border border-[#155e89] transition-all">
        {/* Ambient Decorative Lighting */}
        <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-sky-300/15 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/3 w-[300px] h-[300px] bg-emerald-400/15 rounded-full blur-3xl pointer-events-none translate-y-1/2" />

        {/* Top Hero Content */}
        <div className="p-6 sm:p-8 relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            
            {/* ⚡ Animated Typewriter Badge */}
            <div className="inline-flex items-center gap-2.5 bg-white/10 text-white text-sm px-4 py-1.5 rounded-full border border-white/25 backdrop-blur-md font-semibold shadow-inner min-h-[36px] max-w-full">
              <Zap className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="font-semibold tracking-wide text-white flex items-center">
                <span>{typedText}</span>
                <span className="inline-block w-[2px] h-4 bg-amber-300 ml-1 animate-blink" />
              </span>
            </div>

            {/* Main Title */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight drop-shadow-sm">
              Welcome to <span className="text-sky-200">Mekong Stock System</span>
            </h1>

            {/* Dynamic Rotating Subtitle */}
            <div className="h-7 overflow-hidden relative">
              <div 
                key={highlightIndex}
                className="text-sky-100 text-xs sm:text-sm font-medium opacity-95 animate-in fade-in slide-in-from-bottom-2 duration-300 flex items-center gap-1.5 truncate"
              >
                <span>{HIGHLIGHTS[highlightIndex]}</span>
              </div>
            </div>

            <p className="text-sky-100/80 text-xs leading-relaxed max-w-lg">
              Enterprise Business Management with Decoupled Architecture: Stock · Purchase Orders · Sales · 2FA Security
            </p>
          </div>

          {/* Right Action Button */}
          <div className="shrink-0 flex flex-col items-end gap-2">
            <button 
              onClick={onOpenLauncher}
              className="bg-white text-[#155e89] hover:bg-sky-50 font-bold px-5 py-3 rounded-2xl text-xs sm:text-sm flex items-center gap-2.5 shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer border border-white/60 hover:shadow-sky-900/30"
            >
              <Layers className="w-4 h-4 text-[#2089C8]" />
              <span>Open App Launcher</span>
            </button>
            <span className="text-[10px] text-sky-200/75 font-mono">
              Quick access (⌘K / Ctrl+K)
            </span>
          </div>
        </div>

        {/* ════════════════ INFINITE ANIMATED RUNNING MARQUEE STRIP ════════════════ */}
        <div className="border-t border-white/15 bg-black/20 backdrop-blur-md py-2.5 overflow-hidden select-none">
          <div className="animate-marquee flex items-center gap-8 whitespace-nowrap">
            {/* Duplicated items to make seamless continuous loop */}
            {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, idx) => (
              <div 
                key={idx} 
                className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full transition-all ${
                  item.highlight 
                    ? 'bg-white/15 text-white border border-white/20 shadow-xs' 
                    : 'text-sky-100/90'
                }`}
              >
                <span className="text-sm shrink-0">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Cards (Permission-Filtered) */}
      {accessibleMetrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {accessibleMetrics.map((m, i) => {
            const Icon = m.icon;
            const StatusIcon = m.statusIcon;
            return (
              <div
                key={m.id || m.action}
                onClick={() => setActiveApp(m.action)}
                className={`metric-card ${m.color} p-6 cursor-pointer erp-card-interactive animate-fade-in-up stagger-${i + 1} bg-white`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{m.label}</p>
                    <h3 className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{m.value}</h3>
                    {m.unit && <p className="text-xs text-slate-500 mt-0.5">{m.unit} Total</p>}
                  </div>
                  <div className={`icon-wrap icon-wrap-md icon-wrap-${m.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between text-xs border-t border-slate-100 pt-3">
                  <span className={`${m.statusColor} font-semibold flex items-center gap-1.5`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {m.status}
                  </span>
                  <span className="text-[#2089C8] font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                    {m.actionLabel} →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Module Cards (Permission-Filtered) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#2089C8]" />
            <span>Microservices Modules</span>
            <span className="badge badge-blue ml-1">{accessibleModules.length} Active</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            Role-Based Access Control Enforced
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {accessibleModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div key={mod.id} className={`erp-card p-6 flex flex-col justify-between ${mod.hoverBorder} group bg-white shadow-sm hover:shadow-md transition-all`}>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`icon-wrap icon-wrap-lg ${mod.iconClass} group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`badge ${mod.badgeClass}`}>{mod.badge}</span>
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">{mod.desc}</p>
                </div>
                <button onClick={() => setActiveApp(mod.id)}
                  className={`mt-5 w-full py-2.5 ${mod.btnClass} font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs`}>
                  <span>Open {mod.title}</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

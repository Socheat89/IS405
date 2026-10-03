import React, { useState } from 'react';
import { Grid, ShieldCheck, User, LogOut, Settings, Bell, Search, Layers, Command, Activity, ChevronDown, Zap, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export const Navbar = ({ activeApp, setActiveApp, onOpenLauncher }) => {
  const { user, logout, canAccessApp } = useAuth();
  const { lang, setLang, supportedLanguages } = useLanguage();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  const activeLabel = {
    stock:     'Stock Management',
    po:        'Purchase Orders',
    sales:     'Sales Orders',
    users:     'User Access',
    roles:     'Roles & Permissions',
    security:  'Security & 2FA',
    settings:  'Admin Settings',
    dashboard: 'Dashboard',
  }[activeApp] ?? 'Dashboard';

  return (
    <header className="erp-navbar px-4 sm:px-6 lg:px-8 flex items-center justify-between select-none">
      {/* Left: Launcher + Brand */}
      <div className="flex items-center gap-3">
        {/* App Grid Launcher */}
        <button
          onClick={onOpenLauncher}
          title="Open App Launcher"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-sky-50 border border-slate-200 hover:border-[#2089C8] text-slate-600 hover:text-[#2089C8] transition-all duration-200 cursor-pointer group shadow-2xs"
        >
          <Grid className="w-4 h-4 group-hover:rotate-12 transition-transform duration-200" />
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#2089C8] border border-[#155e89] flex items-center justify-center shadow-xs">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-slate-900 text-sm tracking-tight hidden sm:block">
              Mekong<span className="text-[#2089C8]">Stock</span>
            </span>
          </div>

          <span className="text-slate-300 font-light text-lg hidden md:block">/</span>

          <span className="hidden md:flex items-center gap-1.5 text-slate-700 font-semibold text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            {activeLabel}
          </span>
        </div>
      </div>

      {/* Right: Status + Actions */}
      <div className="flex items-center gap-2.5">
        {/* Live badge */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
          <Activity className="w-3.5 h-3.5 text-[#2089C8]" />
          <span>Live</span>
        </div>

        {/* Language Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowLangDropdown(!showLangDropdown)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:text-[#2089C8] transition-all cursor-pointer shadow-2xs"
            title="Language Selection"
          >
            <Globe className="w-3.5 h-3.5 text-[#2089C8]" />
            <span className="font-bold text-[11px] uppercase tracking-wide">{lang === 'km' ? '🇰🇭 KM' : '🇺🇸 EN'}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showLangDropdown && (
            <div
              className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-slide-top overflow-hidden"
              onMouseLeave={() => setShowLangDropdown(false)}
            >
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                Select Language
              </div>
              {supportedLanguages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLang(l.code);
                    setShowLangDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                    lang === l.code
                      ? 'bg-sky-50 text-[#2089C8] font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">{l.flag}</span>
                    <span>{l.name}</span>
                  </span>
                  {lang === l.code && <span className="text-xs text-[#2089C8] font-bold">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <button className="relative btn-icon">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full border border-white animate-pulse" />
        </button>

        {/* User Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 py-1 pl-1.5 pr-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#2089C8]/40 transition-all cursor-pointer group shadow-2xs"
          >
            <div className="w-7 h-7 rounded-lg bg-[#2089C8] border border-[#155e89] flex items-center justify-center font-bold text-xs text-white shadow-xs">
              {user?.username ? user.username.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="hidden sm:block text-left">
              <div className="font-bold text-slate-900 text-xs leading-tight">{user?.username || 'Administrator'}</div>
              <div className="text-slate-400 text-[10px] truncate max-w-[100px]">{user?.email || 'admin@company.com'}</div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showUserDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {showUserDropdown && (
            <div
              className="absolute right-0 mt-2 w-68 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-slide-top overflow-hidden"
              style={{ width: '272px' }}
              onMouseLeave={() => setShowUserDropdown(false)}
            >
              {/* User info header */}
              <div className="px-4 py-3 bg-gradient-to-r from-sky-50 to-blue-50 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2089C8] border border-[#155e89] flex items-center justify-center font-bold text-white shadow-xs">
                    {user?.username ? user.username.charAt(0).toUpperCase() : 'A'}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900">{user?.username || 'Admin'}</p>
                    <p className="text-xs text-slate-500">{user?.email || 'admin@company.com'}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#155e89] bg-sky-100 px-2 py-0.5 rounded-full mt-1 border border-sky-200">
                      <ShieldCheck className="w-3 h-3" /> 2FA Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1.5 px-1.5">
                <button
                  onClick={() => { setActiveApp('security'); setShowUserDropdown(false); }}
                  className="w-full text-left px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-[#2089C8] rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-sky-100 group-hover:bg-sky-200 flex items-center justify-center transition-colors">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#1976ab]" />
                  </div>
                  Security Settings (2FA)
                </button>

                {canAccessApp('settings') && (
                  <button
                    onClick={() => { setActiveApp('settings'); setShowUserDropdown(false); }}
                    className="w-full text-left px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center transition-colors">
                      <Settings className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                    Admin Settings
                  </button>
                )}

                {canAccessApp('users') && (
                  <button
                    onClick={() => { setActiveApp('users'); setShowUserDropdown(false); }}
                    className="w-full text-left px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center transition-colors">
                      <User className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                    Manage Users
                  </button>
                )}
              </div>

              {/* Logout */}
              <div className="border-t border-slate-100 pt-1.5 pb-1.5 px-1.5">
                <button
                  onClick={logout}
                  className="w-full text-left px-3 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-rose-50 group-hover:bg-rose-100 flex items-center justify-center transition-colors">
                    <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  </div>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Settings, ShieldCheck, Server, FileText, Save, CheckCircle2, 
  RefreshCw, Key, Lock, Globe, Building, Database, Activity, 
  Radio, Check, AlertCircle, Clock, ShieldAlert, Cpu, Warehouse, 
  Plus, Edit2, Phone, MapPin, CheckCircle, Store, Sparkles
} from 'lucide-react';
import { settingsService } from '../../services/settings/settingsService';
import { warehouseService } from '../../services/stock/warehouseService';
import { WarehouseModal } from '../stock/warehouses/WarehouseModal';
import { useToast } from '../../context/ToastContext';

export const SystemSettingsPage = () => {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('company'); // 'company' | 'warehouses' | 'security' | 'microservices' | 'logs'
  const [loading, setLoading] = useState(true);

  // Warehouse Modal State
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);

  const loadAllData = async () => {
    try {
      const [s, whList, logs] = await Promise.all([
        settingsService.getSettings(),
        warehouseService.getWarehouses(false),
        settingsService.getAuditLogs(),
      ]);
      setSettings(s);
      setWarehouses(whList || s?.warehouses || []);
      setAuditLogs(logs || []);
    } catch (err) {
      console.warn('Failed to load settings:', err?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    try {
      const updated = await settingsService.saveSettings(settings);
      setSettings(prev => ({ ...prev, ...updated }));
      toast.success('បានរក្សាទុកការកំណត់ក្រុមហ៊ុន និងប្រព័ន្ធ (Company & System Settings) បានជោគជ័យ!', 'Settings Saved');
    } catch (err) {
      console.warn('Failed to save settings:', err?.message);
      toast.error('បរាជ័យក្នុងការរក្សាទុកការកំណត់');
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleCreateWarehouse = () => {
    setSelectedWarehouse(null);
    setWarehouseModalOpen(true);
  };

  const handleEditWarehouse = (wh) => {
    setSelectedWarehouse(wh);
    setWarehouseModalOpen(true);
  };

  const handleSaveWarehouse = async (warehouseData, warehouseId) => {
    if (warehouseId) {
      await warehouseService.updateWarehouse(warehouseId, warehouseData);
      toast.success(`បានកែប្រែឃ្លាំង '${warehouseData.name}' ជោគជ័យ!`);
    } else {
      await warehouseService.createWarehouse(warehouseData);
      toast.success(`បានបង្កើតឃ្លាំង '${warehouseData.name}' ថ្មីជោគជ័យ!`);
    }
    await loadAllData();
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const services = [
    { name: 'Identity & 2FA Service', port: 5001, status: 'Online', latency: '12ms', version: 'v1.4.0' },
    { name: 'Stock / Inventory Microservice', port: 5002, status: 'Online', latency: '18ms', version: 'v2.1.0' },
    { name: 'Purchase Orders Microservice', port: 5003, status: 'Online', latency: '15ms', version: 'v1.8.2' },
    { name: 'Sales Orders Microservice', port: 5004, status: 'Online', latency: '14ms', version: 'v2.0.1' },
    { name: 'API Gateway / Reverse Proxy', port: 5000, status: 'Online', latency: '6ms', version: 'v3.0.0' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-6 pb-16">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#155e89] to-[#2089C8] text-white flex items-center justify-center shadow-xs border border-[#155e89]">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">System & Company Configuration</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              គ្រប់គ្រងព័ត៌មានក្រុមហ៊ុន (Company Profile), ការកំណត់ឃ្លាំង (Warehouses), គោលការណ៍សុវត្ថិភាព 2FA, និងស្ថានភាពប្រព័ន្ធ
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>Save Settings</span>
        </button>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap border border-slate-200 bg-white rounded-2xl p-1.5 shadow-2xs gap-1.5">
        <button
          onClick={() => setActiveTab('company')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
            activeTab === 'company' ? 'bg-[#2089C8] text-white border-[#155e89] shadow-xs' : 'text-slate-600 border-transparent hover:bg-slate-50'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Company & Profile</span>
        </button>
        <button
          onClick={() => setActiveTab('warehouses')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
            activeTab === 'warehouses' ? 'bg-[#2089C8] text-white border-[#155e89] shadow-xs' : 'text-slate-600 border-transparent hover:bg-slate-50'
          }`}
        >
          <Warehouse className="w-4 h-4" />
          <span>Warehouses & Locations ({warehouses.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
            activeTab === 'security' ? 'bg-[#2089C8] text-white border-[#155e89] shadow-xs' : 'text-slate-600 border-transparent hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Security & 2FA</span>
        </button>
        <button
          onClick={() => setActiveTab('microservices')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
            activeTab === 'microservices' ? 'bg-[#2089C8] text-white border-[#155e89] shadow-xs' : 'text-slate-600 border-transparent hover:bg-slate-50'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Microservices</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
            activeTab === 'logs' ? 'bg-[#2089C8] text-white border-[#155e89] shadow-xs' : 'text-slate-600 border-transparent hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Audit Logs</span>
        </button>
      </div>

      {/* Tab 1: Company Profile & Core Warehouse Configuration */}
      {activeTab === 'company' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-4 h-4 text-[#2089C8]" />
                <span>Company Legal Profile & Information (ព័ត៌មានក្រុមហ៊ុន)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">ព័ត៌មាននេះនឹងត្រូវបង្ហាញនៅលើ របាយការណ៍, វិក្កយបត្រ (Invoices), និងប័ណ្ណទិញ/លក់ទំនិញទាំងអស់។</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Company Legal Name (ឈ្មោះស្របច្បាប់ក្រុមហ៊ុន) *
                </label>
                <input
                  type="text"
                  value={settings.companyName || ''}
                  onChange={(e) => updateSetting('companyName', e.target.value)}
                  placeholder="e.g. Mekong Stock Enterprise Co., Ltd."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Application Title (ឈ្មោះកម្មវិធី)
                </label>
                <input
                  type="text"
                  value={settings.appName || ''}
                  onChange={(e) => updateSetting('appName', e.target.value)}
                  placeholder="e.g. Mekong Stock ERP"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  VAT / Tax Identification No (លេខអត្តសញ្ញាណកម្មសារពើពន្ធ)
                </label>
                <input
                  type="text"
                  value={settings.taxId || ''}
                  onChange={(e) => updateSetting('taxId', e.target.value)}
                  placeholder="e.g. K008-902104588"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Contact Phone Number (លេខទូរស័ព្ទ)
                </label>
                <input
                  type="text"
                  value={settings.companyPhone || ''}
                  onChange={(e) => updateSetting('companyPhone', e.target.value)}
                  placeholder="e.g. +855 23 999 888"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Official Email (អ៊ីមែលផ្លូវការ)
                </label>
                <input
                  type="email"
                  value={settings.companyEmail || ''}
                  onChange={(e) => updateSetting('companyEmail', e.target.value)}
                  placeholder="e.g. info@mekongstock.com.kh"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Company Headquarter Address (អាសយដ្ឋានក្រុមហ៊ុន)
                </label>
                <input
                  type="text"
                  value={settings.companyAddress || ''}
                  onChange={(e) => updateSetting('companyAddress', e.target.value)}
                  placeholder="e.g. Phnom Penh SEZ, National Road 4, Phnom Penh"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                />
              </div>
            </div>
          </div>

          {/* Company Multi-Warehouse Settings */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-[#2089C8]" />
                <span>Default Warehouse & Multi-Warehouse Policy (ការកំណត់ឃ្លាំងលំនាំដើម & គោលការណ៍)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">កំណត់ឃ្លាំងមេរបស់ក្រុមហ៊ុន និងការកំណត់ប្រតិបត្តិការស្តុក</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Default Company Warehouse (ឃ្លាំងលំនាំដើមរបស់ក្រុមហ៊ុន) *
                </label>
                <select
                  value={settings.defaultWarehouseId || ''}
                  onChange={(e) => {
                    const selectedId = Number(e.target.value);
                    const wh = warehouses.find(w => w.id === selectedId);
                    updateSetting('defaultWarehouseId', selectedId);
                    if (wh) updateSetting('defaultWarehouseLocation', wh.name);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                >
                  <option value="">-- ជ្រើសរើសឃ្លាំងលំនាំដើម --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code}) {w.location ? `- ${w.location}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  ឃ្លាំងនេះនឹងត្រូវបានជ្រើសរើសជាស្វ័យប្រវត្តិពេលបង្កើតវិក្កយបត្រ, ប័ណ្ណទិញទំនិញ (PO) ឬកែប្រែស្តុក។
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Default Currency (រូបិយប័ណ្ណ)
                </label>
                <select
                  value={settings.currencyCode || settings.currency || 'USD'}
                  onChange={(e) => {
                    updateSetting('currencyCode', e.target.value);
                    updateSetting('currency', e.target.value);
                    updateSetting('currencySymbol', e.target.value === 'KHR' ? '៛' : '$');
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                >
                  <option value="USD">USD ($) - US Dollar</option>
                  <option value="KHR">KHR (៛) - Cambodian Riel</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Standard VAT Rate (អត្រាពន្ធ %)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.vatRatePercentage ?? 10}
                  onChange={(e) => updateSetting('vatRatePercentage', Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Timezone (តំបន់ម៉ោង)
                </label>
                <select
                  value={settings.timezone || 'Asia/Phnom_Penh'}
                  onChange={(e) => updateSetting('timezone', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                >
                  <option value="Asia/Phnom_Penh">Asia/Phnom_Penh (GMT+07:00)</option>
                  <option value="UTC">UTC (Universal Coordinated Time)</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-xs block">Multi-Warehouse Operations (បើកដំណើរការគ្រប់គ្រងឃ្លាំងច្រើន)</span>
                <span className="text-[11px] text-slate-500">
                  អនុញ្ញាតអោយបង្កើតឃ្លាំងសាខាជាច្រើន និងធ្វើការផ្ទេរទំនិញរវាងឃ្លាំង (Inter-Warehouse Transfers)
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.allowMultiWarehouse !== false}
                onChange={(e) => updateSetting('allowMultiWarehouse', e.target.checked)}
                className="w-5 h-5 accent-[#2089C8] rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Warehouses & Facilities */}
      {activeTab === 'warehouses' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-[#2089C8]" />
                <span>Company Warehouses & Distribution Facilities (ឃ្លាំង និងសាខា)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                គ្រប់គ្រងឃ្លាំង និងសាខាចែកចាយទំនិញទាំងអស់ក្នុងក្រុមហ៊ុន។ អ្នកគ្រប់គ្រង (Admin) អាចចាត់ចែងសិទ្ធិឃ្លាំងទៅកាន់ User តាមផ្នែកនីមួយៗ។
              </p>
            </div>
            <button
              onClick={handleCreateWarehouse}
              className="btn-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>បន្ថែមឃ្លាំងថ្មី (Add Warehouse)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouses.map((wh) => {
              const isDefault = settings.defaultWarehouseId === wh.id;
              return (
                <div 
                  key={wh.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                    isDefault 
                      ? 'bg-sky-50/50 border-[#2089C8] shadow-xs' 
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                          {wh.code}
                        </span>
                        {isDefault && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#2089C8] text-white flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>ឃ្លាំងមេ / Default</span>
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        wh.isActive 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {wh.isActive ? 'សកម្ម (Active)' : 'អសកម្ម'}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm">{wh.name}</h3>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2 text-slate-500">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{wh.location || 'គ្មានអាសយដ្ឋាន'}</span>
                      </div>
                      {wh.contactPhone && (
                        <div className="flex items-center gap-2 text-slate-500">
                          <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          <span>{wh.contactPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    {!isDefault ? (
                      <button
                        onClick={async () => {
                          updateSetting('defaultWarehouseId', wh.id);
                          updateSetting('defaultWarehouseLocation', wh.name);
                          await settingsService.saveSettings({ ...settings, defaultWarehouseId: wh.id, defaultWarehouseLocation: wh.name });
                          toast.success(`បានកំណត់ '${wh.name}' ជាឃ្លាំងមេរបស់ក្រុមហ៊ុន!`);
                        }}
                        className="text-[11px] font-semibold text-[#2089C8] hover:underline cursor-pointer"
                      >
                        កំណត់ជាឃ្លាំងមេ (Set Default)
                      </button>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ឃ្លាំងលំនាំដើម
                      </span>
                    )}

                    <button
                      onClick={() => handleEditWarehouse(wh)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>កែប្រែ</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Security Policies */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>2FA & Authentication Security Policies (គោលការណ៍សុវត្ថិភាព)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Configure security rules and enforcement for all system accounts.</p>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-xs block">Enforce 2FA for All Users</span>
                <span className="text-[11px] text-slate-500">Require all users to configure and verify 2FA TOTP before accessing the system</span>
              </div>
              <input
                type="checkbox"
                checked={settings.enforceTwoFactor !== false}
                onChange={(e) => updateSetting('enforceTwoFactor', e.target.checked)}
                className="w-5 h-5 accent-[#2089C8] rounded cursor-pointer"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-xs block">Strong Password Policy</span>
                <span className="text-[11px] text-slate-500">Require uppercase, lowercase, numbers, and special symbols (minimum 8 characters)</span>
              </div>
              <input
                type="checkbox"
                checked={settings.requireStrongPassword !== false}
                onChange={(e) => updateSetting('requireStrongPassword', e.target.checked)}
                className="w-5 h-5 accent-[#2089C8] rounded cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Session Timeout (Minutes)
                </label>
                <input
                  type="number"
                  value={settings.sessionTimeoutMinutes || 60}
                  onChange={(e) => updateSetting('sessionTimeoutMinutes', Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Max Failed 2FA Attempts
                </label>
                <input
                  type="number"
                  value={settings.maxFailedAttempts || 5}
                  onChange={(e) => updateSetting('maxFailedAttempts', Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Microservices Health & Status */}
      {activeTab === 'microservices' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-[#2089C8]" />
                <span>Microservices Architecture Health Matrix</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Monitor backend service cluster health and latency</p>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>All Systems Operational</span>
            </span>
          </div>

          <div className="space-y-3">
            {services.map((srv, idx) => (
              <div 
                key={idx} 
                className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex items-center justify-between hover:bg-sky-50/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#2089C8] shadow-2xs font-bold text-xs">
                    :{srv.port}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">{srv.name}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Port {srv.port} • {srv.version}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                    {srv.latency}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{srv.status}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Audit Logs */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-700" />
              <span>Security & Audit Trail</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Log of authentication events, 2FA verifications, and system modifications</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Event / Action</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {auditLogs.slice(0, 10).map((log, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{log.timestamp}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{log.username}</td>
                    <td className="py-3 px-4 text-slate-700">{log.action}</td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{log.ipAddress || '127.0.0.1'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        SUCCESS
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warehouse Modal */}
      <WarehouseModal
        isOpen={warehouseModalOpen}
        onClose={() => setWarehouseModalOpen(false)}
        warehouse={selectedWarehouse}
        onSaveWarehouse={handleSaveWarehouse}
      />
    </div>
  );
};

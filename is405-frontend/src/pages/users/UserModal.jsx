import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, UserPlus, Shield, Mail, Lock, User, CheckCircle2, 
  Edit2, KeyRound, CheckSquare, Square, ChevronDown, ChevronUp, Package, 
  ShoppingBag, Tag, Users, ShieldCheck, Sparkles, AlertCircle, ShieldAlert,
  Send, Check, Eye, EyeOff, Warehouse, MapPin, Store
} from 'lucide-react';
import { permissionService } from '../../services/settings/permissionService';
import { roleService } from '../../services/roles/roleService';
import { warehouseService } from '../../services/stock/warehouseService';
import { checkPasswordStrength } from '../../utils/passwordPolicy';

export const UserModal = ({ isOpen, onClose, onSave, initialUser = null, mode = 'create' }) => {
  if (!isOpen) return null;

  const [username, setUsername] = useState(initialUser?.username || '');
  const [email, setEmail] = useState(initialUser?.email || '');
  const [password, setPassword] = useState('');
  const [sendInvite, setSendInvite] = useState(true);
  const [setManualPassword, setSetManualPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [roleIds, setRoleIds] = useState(initialUser?.roleIds || []);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState([]);
  
  // Warehouse scoping state
  const [availableWarehouses, setAvailableWarehouses] = useState([]);
  const [warehouseIds, setWarehouseIds] = useState(initialUser?.warehouseIds || []);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState(initialUser?.defaultWarehouseId || null);

  const [availableRoles, setAvailableRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('BASIC'); // 'BASIC' | 'PERMISSIONS'
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch available system roles, permissions & warehouses
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoadingData(true);
      try {
        const [perms, roles, whs] = await Promise.all([
          permissionService.getAllPermissions(),
          roleService.getRoles(),
          warehouseService.getWarehouses(false)
        ]);
        if (isMounted) {
          setAllPermissions(perms || []);
          setAvailableRoles(roles || []);
          setAvailableWarehouses(whs || []);
        }
      } catch (err) {
        console.error('Failed to load initial data in UserModal', err);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [isOpen]);

  // Initialize or reset state when modal opens or initialUser changes
  useEffect(() => {
    setError('');
    if (initialUser && mode === 'edit') {
      setUsername(initialUser.username || '');
      setEmail(initialUser.email || '');
      setPassword('');
      setRoleIds(initialUser.roleIds || []);
      setWarehouseIds(initialUser.warehouseIds || []);
      setDefaultWarehouseId(initialUser.defaultWarehouseId || (initialUser.warehouseIds && initialUser.warehouseIds[0]) || null);

      // If user has direct permissions, use them
      if (Array.isArray(initialUser.directPermissionIds) && initialUser.directPermissionIds.length > 0) {
        setSelectedPermissionIds(initialUser.directPermissionIds);
      } else if (Array.isArray(initialUser.effectivePermissions) && initialUser.effectivePermissions.length > 0 && allPermissions.length > 0) {
        // Map effective permission code strings to permission IDs
        const codeSet = new Set(initialUser.effectivePermissions.map(c => String(c).toLowerCase()));
        const matchedIds = allPermissions
          .filter(p => codeSet.has((p.code || '').toLowerCase()))
          .map(p => p.id);
        setSelectedPermissionIds(matchedIds);
      } else {
        setSelectedPermissionIds([]);
      }
    } else {
      setUsername('');
      setEmail('');
      setPassword('');
      setRoleIds([]);
      setSelectedPermissionIds([]);
      setWarehouseIds([]);
      setDefaultWarehouseId(null);
    }
  }, [initialUser, mode, isOpen, allPermissions]);

  // Group permissions by category/module
  const groupedPermissions = useMemo(() => {
    const groups = {
      'Stock & Inventory': { icon: Package, color: 'emerald', perms: [] },
      'Purchasing': { icon: ShoppingBag, color: 'purple', perms: [] },
      'Sales & Billing': { icon: Tag, color: 'blue', perms: [] },
      'Users & Access': { icon: Users, color: 'teal', perms: [] },
      'Reports & System': { icon: ShieldCheck, color: 'slate', perms: [] }
    };

    allPermissions.forEach((p) => {
      const code = (p.code || '').toLowerCase();
      if (code.startsWith('stock') || code.startsWith('transfer') || code.startsWith('warehouse')) {
        groups['Stock & Inventory'].perms.push(p);
      } else if (code.startsWith('purchase') || code.startsWith('goods') || code.startsWith('supplier')) {
        groups['Purchasing'].perms.push(p);
      } else if (code.startsWith('sales') || code.startsWith('customer')) {
        groups['Sales & Billing'].perms.push(p);
      } else if (code.startsWith('users') || code.startsWith('roles') || code.startsWith('permissions')) {
        groups['Users & Access'].perms.push(p);
      } else {
        groups['Reports & System'].perms.push(p);
      }
    });

    return groups;
  }, [allPermissions]);

  // Select/Unselect Role with optional auto-preset
  const handleSelectRole = (role) => {
    const isAlreadySelected = roleIds.includes(role.id);
    if (isAlreadySelected) {
      if (roleIds.length > 1) {
        setRoleIds(prev => prev.filter(id => id !== role.id));
      }
      return;
    }

    setRoleIds(prev => [...prev, role.id]);

    // If selecting Admin role -> auto-select all permissions & all warehouses
    if (role.code === 'ADMIN' || role.code === 'ADMINISTRATOR') {
      setSelectedPermissionIds(allPermissions.map(p => p.id));
      setWarehouseIds(availableWarehouses.map(w => w.id));
      if (!defaultWarehouseId && availableWarehouses.length > 0) {
        setDefaultWarehouseId(availableWarehouses[0].id);
      }
    }
  };

  const handleRoleDropdownChange = (e) => {
    const selectedId = Number(e.target.value);
    if (!selectedId) {
      setRoleIds([]);
      return;
    }
    const role = availableRoles.find(r => r.id === selectedId);
    if (!role) return;

    setRoleIds([role.id]);

    // If selecting Admin role -> auto-select all permissions & all warehouses
    if (role.code === 'ADMIN' || role.code === 'ADMINISTRATOR') {
      setSelectedPermissionIds(allPermissions.map(p => p.id));
      setWarehouseIds(availableWarehouses.map(w => w.id));
      if (!defaultWarehouseId && availableWarehouses.length > 0) {
        setDefaultWarehouseId(availableWarehouses[0].id);
      }
    }
  };

  const handleWarehouseDropdownChange = (e) => {
    const val = e.target.value;
    if (val === 'ALL') {
      const allIds = availableWarehouses.map(w => w.id);
      setWarehouseIds(allIds);
      if (!defaultWarehouseId && allIds.length > 0) setDefaultWarehouseId(allIds[0]);
    } else if (val === 'CLEAR') {
      setWarehouseIds([]);
      setDefaultWarehouseId(null);
    } else if (val) {
      const id = Number(val);
      if (!warehouseIds.includes(id)) {
        const next = [...warehouseIds, id];
        setWarehouseIds(next);
        if (!defaultWarehouseId) setDefaultWarehouseId(id);
      }
    }
  };

  // Toggle single permission checkbox
  const togglePermission = (permId) => {
    setSelectedPermissionIds(prev => 
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    );
  };

  // Toggle category group permissions
  const toggleCategoryGroup = (perms) => {
    const permIds = perms.map(p => p.id);
    const allSelected = permIds.every(id => selectedPermissionIds.includes(id));

    if (allSelected) {
      setSelectedPermissionIds(prev => prev.filter(id => !permIds.includes(id)));
    } else {
      setSelectedPermissionIds(prev => Array.from(new Set([...prev, ...permIds])));
    }
  };

  const handleSelectAll = () => {
    setSelectedPermissionIds(allPermissions.map(p => p.id));
  };

  const handleClearAll = () => {
    setSelectedPermissionIds([]);
  };

  // Warehouse selection toggles
  const toggleWarehouse = (whId) => {
    setWarehouseIds(prev => {
      const exists = prev.includes(whId);
      const next = exists ? prev.filter(id => id !== whId) : [...prev, whId];
      if (exists && defaultWarehouseId === whId) {
        setDefaultWarehouseId(next.length > 0 ? next[0] : null);
      } else if (!exists && !defaultWarehouseId) {
        setDefaultWarehouseId(whId);
      }
      return next;
    });
  };

  const handleSelectAllWarehouses = () => {
    if (warehouseIds.length === availableWarehouses.length) {
      setWarehouseIds([]);
      setDefaultWarehouseId(null);
    } else {
      const allIds = availableWarehouses.map(w => w.id);
      setWarehouseIds(allIds);
      if (!defaultWarehouseId && allIds.length > 0) setDefaultWarehouseId(allIds[0]);
    }
  };

  const passwordStrength = useMemo(() => checkPasswordStrength(password), [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (roleIds.length === 0 && availableRoles.length > 0) {
      setRoleIds([availableRoles[0].id]);
    }

    if ((mode === 'create' && setManualPassword && password) || (mode === 'edit' && password)) {
      if (!passwordStrength.isStrong) {
        setError('Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and special symbols.');
        return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      const payload = { 
        username: username.trim(), 
        email: email.trim(), 
        roleIds: roleIds.length > 0 ? roleIds : [availableRoles[0]?.id || 1],
        directPermissionIds: selectedPermissionIds,
        warehouseIds: warehouseIds,
        defaultWarehouseId: defaultWarehouseId ? Number(defaultWarehouseId) : null,
        sendInvitationEmail: mode === 'create' && !setManualPassword
      };

      if ((mode === 'create' && setManualPassword && password) || (mode === 'edit' && password)) {
        payload.password = password;
      }

      await onSave(payload, initialUser?.id);
      window.dispatchEvent(new Event('users_updated'));
      window.dispatchEvent(new Event('permissions_updated'));
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.message || 'Error saving user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="erp-modal-overlay animate-fade-in" onClick={onClose}>
      <div 
        className="erp-modal w-full max-w-3xl max-h-[92vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#155e89] to-[#2089C8] px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20">
              {mode === 'edit' ? <Edit2 className="w-5 h-5 text-white" /> : <UserPlus className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                {mode === 'edit' ? `Edit User (${initialUser?.username})` : 'Create User & Assign Warehouse'}
              </h2>
              <p className="text-xs text-sky-100 mt-0.5 font-medium">
                កំណត់គណនី, តួនាទី (Role), សិទ្ធិឃ្លាំង (Warehouses), និងសិទ្ធិលម្អិត
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center hover:bg-white/15 rounded-xl transition-colors text-white/80 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-gray-200 bg-gray-50 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('BASIC')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'BASIC'
                ? 'border-[#2089C8] text-[#155e89] bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>General, Role & Warehouses</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PERMISSIONS')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'PERMISSIONS'
                ? 'border-[#2089C8] text-[#155e89] bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Permissions Matrix</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              selectedPermissionIds.length > 0 ? 'bg-sky-100 text-[#155e89]' : 'bg-gray-200 text-gray-600'
            }`}>
              {selectedPermissionIds.length} / {allPermissions.length} Active
            </span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
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

          {activeTab === 'BASIC' ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">
                    <User className="w-3.5 h-3.5 text-gray-400 inline mr-1" />
                    <span>Username *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. stock_user or warehouse_mgr"
                    className="form-input font-medium"
                  />
                </div>

                <div>
                  <label className="form-label">
                    <Mail className="w-3.5 h-3.5 text-gray-400 inline mr-1" />
                    <span>Email Address *</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@company.com"
                    className="form-input font-mono"
                  />
                </div>
              </div>

              {/* Warehouse Assignment Dropdown Section */}
              <div className="space-y-2.5 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <label className="form-label flex items-center justify-between !mb-0">
                  <span className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Warehouse className="w-3.5 h-3.5 text-[#2089C8]" />
                    <span>Assigned Warehouse(s) *</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    User will only access data for assigned warehouses
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Multi-Warehouse Selector Dropdown */}
                  <div>
                    <select
                      value=""
                      onChange={handleWarehouseDropdownChange}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                    >
                      <option value="" disabled>-- Select warehouse to assign --</option>
                      <option value="ALL">⭐ Select All Warehouses ({availableWarehouses.length})</option>
                      {warehouseIds.length > 0 && <option value="CLEAR">❌ Clear All Warehouses</option>}
                      <optgroup label="Available Warehouses">
                        {availableWarehouses.map((wh) => (
                          <option key={wh.id} value={wh.id} disabled={warehouseIds.includes(wh.id)}>
                            {wh.name} ({wh.code}) {warehouseIds.includes(wh.id) ? '✓ (Assigned)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* Primary Warehouse Selector */}
                  <div>
                    <select
                      value={defaultWarehouseId || ''}
                      disabled={warehouseIds.length === 0}
                      onChange={(e) => setDefaultWarehouseId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8] disabled:opacity-50"
                    >
                      <option value="">-- Primary / Default Warehouse --</option>
                      {availableWarehouses
                        .filter(wh => warehouseIds.includes(wh.id))
                        .map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            Primary: {wh.name} ({wh.code})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Selected Warehouse Badges / Chips */}
                {warehouseIds.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {availableWarehouses
                      .filter(wh => warehouseIds.includes(wh.id))
                      .map((wh) => {
                        const isPrimary = defaultWarehouseId === wh.id;
                        return (
                          <span
                            key={wh.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                              isPrimary
                                ? 'bg-sky-100 text-[#155e89] border-sky-300 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            <Warehouse className="w-3.5 h-3.5 text-[#2089C8]" />
                            <span>{wh.name}</span>
                            <span className="font-mono text-[10px] text-slate-500 font-bold">({wh.code})</span>
                            {isPrimary && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#2089C8] text-white">
                                Primary
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleWarehouse(wh.id)}
                              className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-slate-200 text-slate-400 hover:text-slate-700 cursor-pointer ml-0.5"
                              title="Remove warehouse"
                            >
                              &times;
                            </button>
                          </span>
                        );
                      })}
                    <button
                      type="button"
                      onClick={() => {
                        setWarehouseIds([]);
                        setDefaultWarehouseId(null);
                      }}
                      className="text-[11px] font-semibold text-rose-600 hover:underline px-1.5 cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-700 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Note: If no warehouse is assigned, non-admin users will not have access to inventory or stock movements.</span>
                  </p>
                )}
              </div>

              {mode === 'create' ? (
                <div className="space-y-3">
                  {/* Option: Email Invitation vs Manual Password */}
                  <div className="p-3.5 bg-gradient-to-r from-sky-50 to-teal-50 border border-sky-200/80 rounded-2xl">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#2089C8] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                          <Send className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            Send Email Invitation (Recommended)
                          </p>
                          <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                            An activation link will be automatically emailed to the user so they can set their own strong password securely.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSetManualPassword(!setManualPassword)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 border ${
                          setManualPassword
                            ? 'bg-[#2089C8] text-white border-[#155e89] shadow-xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {setManualPassword ? '✓ Manual Password' : '+ Set Manually'}
                      </button>
                    </div>
                  </div>

                  {/* Manual Password Input (if enabled) */}
                  {setManualPassword && (
                    <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-3 animate-fade-in">
                      <div>
                        <label className="form-label flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-bold">
                            <Lock className="w-3.5 h-3.5 text-[#2089C8]" />
                            <span>Initial Temporary Password</span>
                          </span>
                          {password && (
                            <span className={`text-[11px] font-bold font-mono ${
                              passwordStrength.isStrong ? 'text-emerald-700' : 'text-rose-600'
                            }`}>
                              {passwordStrength.strengthLabel} ({passwordStrength.metCount}/5)
                            </span>
                          )}
                        </label>
                        <div className="relative flex items-center mt-1">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required={setManualPassword}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter a strong temporary password"
                            className="form-input !pr-11 font-mono text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Password Criteria checklist */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {passwordStrength.criteria.map((c) => (
                          <div 
                            key={c.id} 
                            className={`flex items-center gap-1.5 text-[10px] ${
                              c.met ? 'text-emerald-700 font-bold' : 'text-gray-400'
                            }`}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
                              c.met ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-400'
                            }`}>
                              {c.met ? '✓' : '•'}
                            </span>
                            <span className="truncate">{c.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Edit Mode Password Input */
                <div>
                  <label className="form-label flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                      <span>New Password (leave blank to keep current)</span>
                    </span>
                    {password && (
                      <span className={`text-[11px] font-bold font-mono ${
                        passwordStrength.isStrong ? 'text-emerald-700' : 'text-rose-600'
                      }`}>
                        {passwordStrength.strengthLabel} ({passwordStrength.metCount}/5)
                      </span>
                    )}
                  </label>
                  <div className="relative flex items-center mt-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="form-input !pr-11 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && !passwordStrength.isStrong && (
                    <p className="text-[11px] text-rose-600 mt-1.5 font-medium">
                      Password must be at least 8 characters and include uppercase, lowercase, numbers, and special symbols.
                    </p>
                  )}
                </div>
              )}

              {/* Primary Role Preset Dropdown Section */}
              <div>
                <label className="form-label flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Shield className="w-3.5 h-3.5 text-[#2089C8]" />
                    <span>Primary Role Preset *</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Select a role to auto-preset permissions
                  </span>
                </label>

                {loadingData ? (
                  <div className="py-2 text-xs text-slate-400">Loading system roles...</div>
                ) : (
                  <div className="space-y-2 mt-1">
                    <select
                      value={roleIds.length > 0 ? roleIds[0] : ''}
                      onChange={handleRoleDropdownChange}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8]"
                    >
                      <option value="" disabled>-- Select Primary Role Preset --</option>
                      {availableRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name} ({role.code}) {role.description ? `— ${role.description}` : ''}
                        </option>
                      ))}
                    </select>

                    {/* Selected Role description card */}
                    {roleIds.length > 0 && (
                      <div className="p-3 bg-sky-50/60 border border-sky-200/80 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#2089C8]" />
                          <span className="font-bold text-[#155e89]">
                            {availableRoles.find(r => r.id === roleIds[0])?.name}
                          </span>
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-white text-slate-700 border border-slate-200">
                            {availableRoles.find(r => r.id === roleIds[0])?.code}
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            {availableRoles.find(r => r.id === roleIds[0])?.description}
                          </span>
                        </div>
                        {availableRoles.find(r => r.id === roleIds[0])?.code === 'ADMIN' && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                            Full Admin Access
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Permissions Tab */
            <div className="space-y-4">
              {/* Permission Summary Toolbar */}
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-800">Granted Permissions:</span>
                  <span className="text-xs font-mono font-bold text-[#155e89] bg-sky-100 px-2.5 py-0.5 rounded-full">
                    {selectedPermissionIds.length} / {allPermissions.length} Active
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 text-xs font-semibold text-[#155e89] bg-sky-50 border border-sky-200 rounded-xl hover:bg-sky-100 transition-colors cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Grouped Permissions Matrix */}
              {loadingData ? (
                <div className="py-12 text-center text-xs text-gray-400">Loading permission matrix...</div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedPermissions).map(([category, { icon: Icon, color, perms }]) => {
                    if (perms.length === 0) return null;
                    const isCollapsed = Boolean(collapsedCategories[category]);
                    const groupIds = perms.map(p => p.id);
                    const selectedInGroup = groupIds.filter(id => selectedPermissionIds.includes(id)).length;
                    const isAllSelected = selectedInGroup === perms.length;

                    return (
                      <div key={category} className="border border-gray-200 bg-white rounded-2xl overflow-hidden shadow-2xs">
                        {/* Group Header */}
                        <div className="p-3.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between gap-2">
                          <div 
                            className="flex items-center gap-2.5 cursor-pointer select-none flex-1"
                            onClick={() => setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                          >
                            <div className="w-7 h-7 rounded-lg bg-sky-100 text-[#155e89] flex items-center justify-center">
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-gray-900">{category}</h4>
                              <span className="text-[10px] text-gray-500 font-mono">
                                {selectedInGroup} of {perms.length} granted
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleCategoryGroup(perms)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                                isAllSelected
                                  ? 'bg-[#2089C8] text-white border-[#155e89]'
                                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {isAllSelected ? 'Deselect Module' : 'Select Module'}
                            </button>

                            <button
                              type="button"
                              onClick={() => setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60 cursor-pointer"
                            >
                              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Group Permissions List */}
                        {!isCollapsed && (
                          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {perms.map((p) => {
                              const isChecked = selectedPermissionIds.includes(p.id);

                              return (
                                <div
                                  key={p.id}
                                  onClick={() => togglePermission(p.id)}
                                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                                    isChecked
                                      ? 'border-[#2089C8] bg-sky-50/50 ring-1 ring-sky-200'
                                      : 'border-gray-100 bg-white hover:border-gray-200'
                                  }`}
                                >
                                  <div className="mt-0.5">
                                    {isChecked ? (
                                      <CheckSquare className="w-4 h-4 text-[#2089C8]" />
                                    ) : (
                                      <Square className="w-4 h-4 text-gray-300" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className={`text-xs font-bold truncate ${isChecked ? 'text-[#155e89]' : 'text-gray-800'}`}>
                                        {p.name || p.code}
                                      </span>
                                      {p.action && (
                                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-gray-100 text-gray-500 shrink-0">
                                          {p.action}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] font-mono text-gray-400 block truncate mt-0.5">{p.code}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
            <span className="text-[11px] text-gray-500 font-medium">
              {warehouseIds.length > 0 
                ? `🏢 ${warehouseIds.length} Warehouse(s) Assigned` 
                : '⚠️ No Warehouse Assigned'}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary py-2 text-xs"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary py-2 text-xs px-5 shadow-md flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <span className="spinner !w-3.5 !h-3.5 border-white/30 !border-t-white" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{mode === 'edit' ? 'Save Changes' : 'Create User'}</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

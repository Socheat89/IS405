import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, ShieldCheck, Check, Plus, Lock, Crown, 
  Package, Users, KeyRound, Eye, ShieldAlert, Sparkles,
  Pencil, Trash2, X, Shield, CheckSquare, Square,
  ChevronDown, ChevronUp, ShoppingBag, Tag, Star,
  Settings, AlertTriangle, UserCog, AlertCircle
} from 'lucide-react';
import { ControlPanel } from '../../components/common/ControlPanel';
import { roleService } from '../../services/roles/roleService';
import { RolePermissionModal } from './RolePermissionModal';
import { permissionService } from '../../services/settings/permissionService';
import { useAuth } from '../../context/AuthContext';
import { useApiError } from '../../hooks/useApiError';

/* ─────────────────────────────────────────────
   Create / Edit Role Modal
───────────────────────────────────────────── */
const CreateRoleModal = ({ isOpen, onClose, onSave, existingRole = null }) => {
  const [form, setForm] = useState({ name: '', code: '', description: '', isPrimary: false });
  const [selectedPermIds, setSelectedPermIds] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState({});

  const isEdit = !!existingRole;

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    setLoading(true);
    permissionService.getAllPermissions().then(perms => {
      if (mounted) { setAllPermissions(perms); setLoading(false); }
    }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && existingRole) {
      setForm({
        name: existingRole.name || '',
        code: existingRole.code || '',
        description: existingRole.description || '',
        isPrimary: existingRole.isPrimary || false
      });
      setSelectedPermIds(existingRole.permissionIds || []);
    } else if (isOpen && !existingRole) {
      setForm({ name: '', code: '', description: '', isPrimary: false });
      setSelectedPermIds([]);
    }
    setError('');
  }, [isOpen, existingRole]);

  const groupedPermissions = useMemo(() => {
    const groups = {
      'Stock & Inventory': { icon: Package, perms: [] },
      'Purchasing':        { icon: ShoppingBag, perms: [] },
      'Sales & Billing':  { icon: Tag, perms: [] },
      'Users & Access':   { icon: Users, perms: [] },
      'Reports & System': { icon: ShieldCheck, perms: [] }
    };
    allPermissions.forEach(p => {
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

  const togglePerm = (id) => setSelectedPermIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );
  const selectGroup = (perms, all) => {
    const ids = perms.map(p => p.id);
    if (all) setSelectedPermIds(prev => Array.from(new Set([...prev, ...ids])));
    else setSelectedPermIds(prev => prev.filter(x => !ids.includes(x)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Role name is required.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSave(existingRole?.id || null, {
        ...form,
        code: form.code.trim().toUpperCase() || form.name.trim().toUpperCase().replace(/\s+/g, '_'),
        permissionIds: selectedPermIds
      });
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.message || 'Failed to save role.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="erp-modal-overlay animate-fade-in" onClick={onClose}>
      <div
        className="erp-modal w-full max-w-2xl max-h-[92vh] flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1976ab] to-[#2089C8] px-6 py-4 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
              {isEdit ? <Pencil className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-white">
                {isEdit ? `Edit Role: ${existingRole.name}` : 'Create New Role'}
              </h2>
              <p className="text-xs text-sky-100 mt-0.5 font-medium">
                Define role identity and assign permission matrix
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/15 rounded-xl transition-colors text-white/80 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Role Details */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex justify-between items-center">
                <span>{error}</span>
                <button type="button" onClick={() => setError('')}><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Role Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Purchasing Manager"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8] transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Role Code (auto-generated if blank)
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. PURCHASING_MGR"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8] transition-all font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Description
              </label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Briefly describe this role's responsibilities..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2089C8]/30 focus:border-[#2089C8] transition-all"
              />
            </div>

            {/* Primary System Role toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <div
                onClick={() => setForm(f => ({ ...f, isPrimary: !f.isPrimary }))}
                className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${form.isPrimary ? 'bg-amber-500' : 'bg-slate-300'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isPrimary ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500" />
                Mark as Primary System Role
              </span>
              <span className="text-[10px] text-slate-400 font-normal">(displayed with crown badge)</span>
            </label>
          </div>

          {/* Permission Selector */}
          <div className="px-6 pt-3 pb-1 shrink-0 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              Assign Permissions
              <span className="ml-2 text-[10px] font-mono bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full border border-sky-200">
                {selectedPermIds.length} / {allPermissions.length}
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setSelectedPermIds(allPermissions.map(p => p.id))} className="px-2.5 py-1 text-[11px] font-semibold text-[#2089C8] bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors cursor-pointer">Select All</button>
              <button type="button" onClick={() => setSelectedPermIds([])} className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">Clear</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-2.5 min-h-0">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <div className="w-6 h-6 border-2 border-[#2089C8] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading permissions...
              </div>
            ) : (
              Object.entries(groupedPermissions).map(([cat, { icon: Icon, perms }]) => {
                if (perms.length === 0) return null;
                const collapsed = collapsedCategories[cat];
                const catSel = perms.filter(p => selectedPermIds.includes(p.id)).length;
                const allSel = catSel === perms.length;
                return (
                  <div key={cat} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 cursor-pointer flex-1 select-none" onClick={() => setCollapsedCategories(p => ({ ...p, [cat]: !p[cat] }))}>
                        <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-xs text-slate-800">{cat}</span>
                        <span className="text-[10px] font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded-full text-slate-500">{catSel}/{perms.length}</span>
                        {collapsed ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronUp className="w-3 h-3 text-slate-400" />}
                      </div>
                      <button type="button" onClick={() => selectGroup(perms, !allSel)} className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 px-2 py-1 hover:bg-purple-50 rounded cursor-pointer transition-colors">
                        {allSel ? 'Deselect Group' : 'Select Group'}
                      </button>
                    </div>
                    {!collapsed && (
                      <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {perms.map(p => {
                          const checked = selectedPermIds.includes(p.id);
                          return (
                            <div key={p.id} onClick={() => togglePerm(p.id)}
                              className={`p-2 rounded-lg border text-xs flex items-start gap-2 transition-all cursor-pointer ${checked ? 'border-purple-400 bg-purple-50/50 text-purple-950 font-semibold' : 'border-slate-200 bg-slate-50/50 text-slate-500 hover:bg-slate-50'}`}
                            >
                              {checked ? <CheckSquare className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" /> : <Square className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />}
                              <div className="min-w-0">
                                <div className="truncate font-bold text-slate-800">{p.description || p.code}</div>
                                <div className="font-mono text-[10px] text-slate-400 truncate">{p.code}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary py-2 text-xs">Cancel</button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary py-2 text-xs px-5 shadow-md flex items-center gap-1.5"
            >
              {submitting
                ? <><span className="spinner !w-3.5 !h-3.5 border-white/30 !border-t-white" /><span>Saving...</span></>
                : <><Plus className="w-3.5 h-3.5" /><span>{isEdit ? 'Update Role' : 'Create Role'}</span></>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Primary System Role Config Panel (Admin only)
───────────────────────────────────────────── */
const PrimarySystemRolePanel = ({ roles, onMarkPrimary }) => {
  const primaryRole = roles.find(r => r.isPrimary) || roles.find(r => r.name === 'Administrator');
  const nonSystemRoles = roles.filter(r => !['Administrator'].includes(r.name));

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-3xl border border-amber-200 shadow-xs p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center">
            <Star className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              Primary System Role Configuration
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold border border-amber-200">
                Admin Only
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Set which role is treated as the Primary administrative role for the system
            </p>
          </div>
        </div>
        {primaryRole && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-xl">
            <Crown className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-bold text-amber-800">Current: {primaryRole.name}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {roles.map(role => {
          const isCurrent = role.isPrimary || (role.name === 'Administrator' && !roles.some(r => r.isPrimary));
          return (
            <div
              key={role.id}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                isCurrent
                  ? 'bg-amber-100 border-amber-400 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/30'
              }`}
            >
              <div className="flex items-center gap-2">
                {isCurrent
                  ? <Crown className="w-4 h-4 text-amber-600" />
                  : <UserCog className="w-4 h-4 text-slate-400" />
                }
                <div>
                  <div className="text-xs font-bold text-slate-800">{role.name}</div>
                  <div className="text-[10px] font-mono text-slate-400">{role.code}</div>
                </div>
              </div>
              {!isCurrent && (
                <button
                  onClick={() => onMarkPrimary(role.id)}
                  className="px-2 py-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  Set Primary
                </button>
              )}
              {isCurrent && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">Active</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Main RoleListPage
───────────────────────────────────────────── */
import { useToast } from '../../context/ToastContext';

export const RoleListPage = () => {
  const { hasPermission, user } = useAuth();
  const toast = useToast();

  const canCreate = user?.isAdmin || hasPermission('roles.create') || hasPermission('*');
  const canEdit   = user?.isAdmin || hasPermission('roles.edit') || hasPermission('permissions.edit') || hasPermission('*');
  const canDelete = user?.isAdmin || hasPermission('roles.delete') || hasPermission('*');
  const isAdmin   = user?.isAdmin || hasPermission('*');

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState(null);
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // role id to confirm delete

  const SYSTEM_ROLES = ['Administrator']; // cannot be deleted

  const { apiError, clearError, withErrorHandling } = useApiError();

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const data = await roleService.getRoles();
      setRoles(data);
    } catch (err) {
      console.error('[RoleListPage] getRoles failed:', err?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const handleSaveRolePermissions = async (roleId, updatedData) => {
    if (!canEdit) return;
    await withErrorHandling(async () => {
      await roleService.updateRole(roleId, updatedData);
      toast.success('Role permissions saved successfully!');
      window.dispatchEvent(new Event('roles_updated'));
      window.dispatchEvent(new Event('permissions_updated'));
      await fetchRoles();
    });
  };

  const handleCreateOrUpdateRole = async (roleId, formData) => {
    if (roleId && !canEdit) return;
    if (!roleId && !canCreate) return;
    await withErrorHandling(async () => {
      if (roleId) {
        await roleService.updateRole(roleId, formData);
        toast.success(`Role '${formData.name}' updated successfully!`);
      } else {
        await roleService.createRole(formData);
        toast.success(`New role '${formData.name}' created successfully!`);
      }
      window.dispatchEvent(new Event('roles_updated'));
      window.dispatchEvent(new Event('permissions_updated'));
      await fetchRoles();
    });
  };

  const handleDeleteRole = async (roleId) => {
    if (!canDelete) return;
    try {
      await roleService.deleteRole(roleId);
      toast.success('Role deleted successfully!');
    } catch (err) {
      console.warn('Delete role failed:', err?.message);
      toast.error('Failed to delete this role!');
    }
    window.dispatchEvent(new Event('roles_updated'));
    setDeleteConfirm(null);
    await fetchRoles();
  };

  const handleMarkPrimary = async (roleId) => {
    if (!isAdmin) return;
    // UI-only: marks a role as primary in the fetched list (no DB field for this)
    setRoles(prev => prev.map(r => ({ ...r, isPrimary: r.id === roleId })));
    window.dispatchEvent(new Event('roles_updated'));
    window.dispatchEvent(new Event('permissions_updated'));
  };

  const getRoleIcon = (role) => {
    if (role.isPrimary || role.name === 'Administrator')
      return <Crown className="w-5 h-5 text-amber-500" />;
    if (role.name === 'StockManager')
      return <Package className="w-5 h-5 text-[#2089C8]" />;
    return <Eye className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="min-h-full pb-16">
      <ControlPanel
        title="Roles & Permissions Management"
        subtitle="Create, configure, and assign role permission matrices across all microservices"
        onRefresh={fetchRoles}
        loading={loading}
        actions={
          canCreate ? (
            <button
              onClick={() => { setEditingRole(null); setIsCreateModalOpen(true); }}
              className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Create Role</span>
            </button>
          ) : null
        }
      />

      {/* API Error Banner */}
      {apiError && (
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl px-4 py-3 text-sm font-medium shadow-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
            <span className="flex-1">{apiError}</span>
            <button onClick={clearError} className="text-rose-400 hover:text-rose-600 font-bold text-lg leading-none cursor-pointer">&times;</button>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-8">

        {/* Primary System Role Config */}
        {!loading && roles.length > 0 && isAdmin && (
          <PrimarySystemRolePanel roles={roles} onMarkPrimary={handleMarkPrimary} />
        )}

        {/* Role Cards Grid */}
        {loading ? (
          <div className="py-24 text-center text-slate-500">
            <div className="w-10 h-10 border-4 border-[#2089C8] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-medium text-slate-600">Loading roles and permissions data...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role) => {
              const isAdmin = role.name === 'Administrator' || role.isPrimary;
              const permCount = isAdmin ? '∞' : (role.permissionIds?.length || 0);
              const isSystem = SYSTEM_ROLES.includes(role.name);

              return (
                <div
                  key={role.id}
                  className={`erp-card p-6 flex flex-col justify-between transition-all hover:shadow-lg bg-white ${
                    isAdmin ? 'border-t-4 border-t-amber-500 ring-1 ring-amber-500/20' : 'border-t-4 border-t-[#2089C8]'
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2.5 rounded-2xl ${isAdmin ? 'bg-amber-50' : 'bg-sky-50'}`}>
                          {getRoleIcon(role)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                            {role.name}
                            {role.isPrimary && (
                              <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">PRIMARY</span>
                            )}
                          </h3>
                          <span className="text-[10px] font-mono text-slate-400">Role ID #{role.id}</span>
                        </div>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                        isAdmin
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-sky-50 text-[#1976ab] border-sky-200'
                      }`}>
                        {isAdmin ? 'All Perms' : `${permCount} Perms`}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      {role.description || 'Manage functionality based on assigned permission matrix'}
                    </p>

                    {/* Permission chips (max 5 shown) */}
                    {!isAdmin && role.permissionNames && role.permissionNames.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {role.permissionNames.slice(0, 5).map((p) => (
                          <span key={p} className="text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                            {p}
                          </span>
                        ))}
                        {role.permissionNames.length > 5 && (
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full">
                            +{role.permissionNames.length - 5} more
                          </span>
                        )}
                      </div>
                    )}

                    {isAdmin && (
                      <div className="flex items-center gap-1.5 mb-4">
                        <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Crown className="w-3 h-3" /> Full System Access — All Permissions Granted
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {(canEdit || canDelete) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 font-semibold text-emerald-600">
                        <ShieldCheck className="w-3.5 h-3.5" /> RBAC Enforced
                      </span>
                      <div className="flex items-center gap-1.5">
                        {/* Edit Role metadata */}
                        {canEdit && (
                          <button
                            onClick={() => { setEditingRole(role); setIsCreateModalOpen(true); }}
                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Edit Role"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Edit Permissions */}
                        {canEdit && (
                          <button
                            onClick={() => { setSelectedRoleForPerms(role); setIsPermModalOpen(true); }}
                            className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-[#2089C8] border border-sky-200 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Permissions</span>
                          </button>
                        )}

                        {/* Delete (only non-system roles) */}
                        {!isSystem && canDelete && (
                          <button
                            onClick={() => setDeleteConfirm(role.id)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Delete Role"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add New Role Card */}
            {canCreate && (
              <div
                onClick={() => { setEditingRole(null); setIsCreateModalOpen(true); }}
                className="erp-card p-6 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 hover:border-[#2089C8] hover:bg-sky-50/30 transition-all cursor-pointer group min-h-[220px]"
              >
                <div className="w-12 h-12 rounded-2xl bg-sky-50 group-hover:bg-sky-100 border-2 border-dashed border-sky-200 flex items-center justify-center transition-colors">
                  <Plus className="w-5 h-5 text-[#2089C8]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-500 group-hover:text-[#2089C8] transition-colors">Create New Role</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Define access matrix for a new system role</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Permission Matrix Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Permission Matrix Overview</h3>
              <p className="text-xs text-slate-500 mt-0.5">Cross-role permission reference across all microservices</p>
            </div>
            <span className="px-3 py-1 bg-sky-50 text-[#155e89] rounded-xl text-xs font-semibold border border-sky-200">
              RBAC Policy v2.0
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Permission</th>
                  <th className="py-3 px-4">Category</th>
                  {roles.map(r => (
                    <th key={r.id} className="py-3 px-4 text-center">{r.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {[
                  { id: 'stock.view', name: 'Stock View', category: 'Stock' },
                  { id: 'stock-items.create', name: 'Items Create', category: 'Stock' },
                  { id: 'stock-items.edit', name: 'Items Edit', category: 'Stock' },
                  { id: 'purchase-orders.view', name: 'PO View', category: 'Purchasing' },
                  { id: 'purchase-orders.create', name: 'PO Create', category: 'Purchasing' },
                  { id: 'sales-orders.view', name: 'Sales View', category: 'Sales' },
                  { id: 'users.view', name: 'Users View', category: 'Users' },
                  { id: 'roles.view', name: 'Roles View', category: 'Roles' },
                  { id: 'settings.view', name: 'Settings View', category: 'System' },
                ].map(perm => (
                  <tr key={perm.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800 text-[11px]">{perm.id}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">{perm.category}</span>
                    </td>
                    {roles.map(r => {
                      const isAdminRole = r.name === 'Administrator' || r.isPrimary;
                      const hasPerm = isAdminRole || r.permissionNames?.includes(perm.id) || r.permissionNames?.includes('*');
                      return (
                        <td key={r.id} className="py-3 px-4 text-center">
                          {isAdminRole
                            ? <span className="text-amber-600 font-bold">✓ Full</span>
                            : hasPerm
                              ? <span className="text-emerald-600 font-bold">✓</span>
                              : <span className="text-slate-300">—</span>
                          }
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Permissions Modal */}
      <RolePermissionModal
        isOpen={isPermModalOpen}
        onClose={() => setIsPermModalOpen(false)}
        role={selectedRoleForPerms}
        onSave={handleSaveRolePermissions}
      />

      {/* Create / Edit Role Modal */}
      <CreateRoleModal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setEditingRole(null); }}
        onSave={handleCreateOrUpdateRole}
        existingRole={editingRole}
      />

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="erp-modal-overlay animate-fade-in" onClick={() => setDeleteConfirm(null)}>
          <div className="erp-modal w-full max-w-sm p-6 my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-rose-100 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Delete Role?</h3>
                <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Deleting this role will remove it from the system. Users assigned to this role may lose their access. Make sure to reassign affected users first.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary py-2 text-xs">Cancel</button>
              <button
                onClick={() => handleDeleteRole(deleteConfirm)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Shield, CheckSquare, Square, ChevronDown, ChevronUp, Package, 
  ShoppingBag, Tag, Users, ShieldCheck, Check, Sparkles
} from 'lucide-react';
import { permissionService } from '../../services/settings/permissionService';

export const RolePermissionModal = ({ isOpen, onClose, role, onSave }) => {
  if (!isOpen || !role) return null;

  const [selectedPermIds, setSelectedPermIds] = useState(role.permissionIds || []);
  const [allPermissions, setAllPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const perms = await permissionService.getAllPermissions();
        if (isMounted) setAllPermissions(perms);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    setSelectedPermIds(role.permissionIds || []);
  }, [role]);

  // Group permissions
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

  const togglePermission = (id) => {
    setSelectedPermIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectCategory = (categoryPerms, selectAll) => {
    const ids = categoryPerms.map(p => p.id);
    if (selectAll) {
      setSelectedPermIds(prev => Array.from(new Set([...prev, ...ids])));
    } else {
      setSelectedPermIds(prev => prev.filter(x => !ids.includes(x)));
    }
  };

  const handleSelectAll = () => setSelectedPermIds(allPermissions.map(p => p.id));
  const handleClearAll = () => setSelectedPermIds([]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onSave(role.id, {
        name: role.name,
        description: role.description,
        permissionIds: selectedPermIds
      });
      window.dispatchEvent(new Event('permissions_updated'));
      window.dispatchEvent(new Event('roles_updated'));
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.message || 'Error saving role permissions');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="erp-modal-overlay animate-fade-in" onClick={onClose}>
      <div 
        className="erp-modal w-full max-w-2xl max-h-[90vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1976ab] to-[#2089C8] px-6 py-4 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-white">
                Edit Role Permissions: {role.name}
              </h2>
              <p className="text-xs text-sky-100 mt-0.5 font-medium">
                Configure authorized operations and access levels for this role
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

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Assigned Permissions:</span>
            <span className="text-xs font-mono font-bold text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded-full border border-sky-200">
              {selectedPermIds.length} / {allPermissions.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1 text-[11px] font-semibold text-[#2089C8] bg-sky-50 border border-sky-200 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Permissions Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center justify-between shadow-2xs">
              <span className="font-semibold">{error}</span>
              <button 
                type="button" 
                onClick={() => setError('')} 
                className="text-rose-400 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-500">
              <div className="w-6 h-6 border-2 border-[#2089C8] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading permissions...
            </div>
          ) : (
            Object.entries(groupedPermissions).map(([category, { icon: Icon, perms }]) => {
              if (perms.length === 0) return null;
              const isCollapsed = collapsedCategories[category];
              const categorySelectedCount = perms.filter(p => selectedPermIds.includes(p.id)).length;
              const isAllSelected = categorySelectedCount === perms.length;

              return (
                <div key={category} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                    <div 
                      className="flex items-center gap-2.5 cursor-pointer select-none flex-1"
                      onClick={() => setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                    >
                      <div className="w-7 h-7 rounded-lg bg-sky-100 text-[#2089C8] flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-xs text-slate-900">{category}</span>
                      <span className="text-[10px] font-mono bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-600">
                        {categorySelectedCount} / {perms.length}
                      </span>
                      {isCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectCategory(perms, !isAllSelected)}
                      className="text-[10px] font-semibold text-[#2089C8] hover:text-[#1976ab] px-2 py-1 hover:bg-sky-50 rounded transition-colors cursor-pointer border border-transparent hover:border-sky-200"
                    >
                      {isAllSelected ? 'Deselect Group' : 'Select Group'}
                    </button>
                  </div>

                  {!isCollapsed && (
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white">
                      {perms.map((p) => {
                        const checked = selectedPermIds.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => togglePermission(p.id)}
                            className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all cursor-pointer ${
                              checked
                                ? 'border-[#2089C8] bg-sky-50/50 text-[#155e89] font-semibold ring-1 ring-[#2089C8]/20'
                                : 'border-slate-200 bg-slate-50/40 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <div className="mt-0.5">
                              {checked ? (
                                <CheckSquare className="w-4 h-4 text-[#2089C8]" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs truncate font-bold text-slate-900 block">{p.description || p.code}</span>
                              <span className="text-[10px] font-mono text-slate-400 block truncate">{p.code}</span>
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
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Role: <strong>{role.name}</strong> (#{role.id})
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
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="btn-primary py-2 text-xs px-5 shadow-sm flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <span className="spinner !w-3.5 !h-3.5 border-white/30 !border-t-white" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Role Permissions</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

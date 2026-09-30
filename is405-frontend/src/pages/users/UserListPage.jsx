import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, ShieldCheck, ShieldAlert, UserPlus, Power, CheckCircle, 
  XCircle, Mail, Shield, UserCheck, Search, Filter, Edit2, Trash2, KeyRound, AlertCircle,
  Send, Copy, Check
} from 'lucide-react';
import { ControlPanel } from '../../components/common/ControlPanel';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { userService } from '../../services/users/userService';
import { UserModal } from './UserModal';
import { useAuth } from '../../context/AuthContext';
import { useApiError } from '../../hooks/useApiError';

import { useToast } from '../../context/ToastContext';

export const UserListPage = () => {
  const { hasPermission } = useAuth();
  const toast = useToast();

  const canCreate = hasPermission('users.create');
  const canEdit = hasPermission('users.edit');
  const canDelete = hasPermission('users.delete');

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | '2FA_ON' | '2FA_OFF'
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [selectedUser, setSelectedUser] = useState(null);

  // Delete Confirm Modal State
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    user: null,
  });

  const { apiError, clearError, withErrorHandling } = useApiError();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('[UserListPage] getUsers failed:', err?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateNew = () => {
    if (!canCreate) return;
    setSelectedUser(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEditUser = (user) => {
    if (!canEdit) return;
    setSelectedUser(user);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleSaveUser = async (userData, userId) => {
    await withErrorHandling(async () => {
      if (modalMode === 'edit' && userId) {
        if (!canEdit) return;
        await userService.updateUser(userId, userData);
        toast.success(`បានរក្សាទុក និងកែប្រែគណនី '${userData.username}' បានជោគជ័យ!`);
      } else {
        if (!canCreate) return;
        await userService.createUser(userData);
        toast.success(`បានបង្កើតគណនី '${userData.username}' និងរៀបចំ Invitation បានជោគជ័យ!`);
      }
      window.dispatchEvent(new Event('users_updated'));
      window.dispatchEvent(new Event('permissions_updated'));
      await fetchUsers();
    });
  };

  const handleDeleteUser = (user) => {
    if (!canDelete) return;
    setDeleteConfirm({ isOpen: true, user });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.user || !canDelete) return;
    await withErrorHandling(async () => {
      await userService.deleteUser(deleteConfirm.user.id);
      toast.success(`បានលុបគណនី '${deleteConfirm.user.username}' រួចរាល់!`);
      setDeleteConfirm({ isOpen: false, user: null });
      window.dispatchEvent(new Event('users_updated'));
      window.dispatchEvent(new Event('permissions_updated'));
      await fetchUsers();
    });
  };

  const handleToggleStatus = async (userId) => {
    if (!canEdit) return;
    await withErrorHandling(async () => {
      await userService.toggleUserStatus(userId);
      toast.success('បានផ្លាស់ប្តូរស្ថានភាពគណនីបានជោគជ័យ!');
      window.dispatchEvent(new Event('users_updated'));
      window.dispatchEvent(new Event('permissions_updated'));
      await fetchUsers();
    });
  };

  const handleResendInvite = async (user) => {
    await withErrorHandling(async () => {
      const res = await userService.resendInvitation(user.id);
      toast.success(`បានបង្កើត Invitation Link ថ្មី និងផ្ញើទៅកាន់ ${user.email}!`, 'Resent Invitation');
      await fetchUsers();
    });
  };

  const handleCopyInviteLink = (link) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast.info('បានចម្លង Invitation Link ទៅកាន់ Clipboard រួចរាល់!', 'Copied Link');
  };

  const metrics = useMemo(() => {
    const total = users.length;
    const secured2FA = users.filter(u => u.twoFactorEnabled).length;
    const active = users.filter(u => u.isActive !== false).length;
    const percentage2FA = total > 0 ? Math.round((secured2FA / total) * 100) : 0;
    return { total, secured2FA, active, percentage2FA };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = searchQuery === '' || 
        u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchQuery.toLowerCase());

      if (filterTab === '2FA_ON') return matchSearch && u.twoFactorEnabled;
      if (filterTab === '2FA_OFF') return matchSearch && !u.twoFactorEnabled;
      return matchSearch;
    });
  }, [users, searchQuery, filterTab]);

  const statusOptions = [
    { label: 'All Users', value: 'ALL' },
    { label: '2FA Enabled', value: '2FA_ON' },
    { label: '2FA Disabled', value: '2FA_OFF' },
  ];

  return (
    <div className="min-h-full pb-16">
      <ControlPanel
        title="Users & Access Management"
        subtitle="Manage system user accounts, assigned roles, and security authentication parameters"
        onCreateNew={canCreate ? handleCreateNew : null}
        createLabel="New User Account"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={filterTab}
        onStatusFilterChange={setFilterTab}
        statusOptions={statusOptions}
        onRefresh={fetchUsers}
        loading={loading}
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

      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-6">
        {/* KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="erp-card p-4.5 relative overflow-hidden flex items-center justify-between border-l-4 border-l-[#2089C8] bg-white">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Accounts</p>
              <h4 className="text-2xl font-bold font-mono text-[#2089C8] mt-1">{metrics.total}</h4>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Registered Users</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#2089C8] border border-sky-100 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4 relative overflow-hidden flex items-center justify-between border-l-4 border-l-emerald-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Status</p>
              <h4 className="text-2xl font-bold font-mono text-emerald-700 mt-1">{metrics.active}</h4>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Enabled Users</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4 relative overflow-hidden flex items-center justify-between border-l-4 border-l-blue-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">2FA Compliance</p>
              <h4 className="text-2xl font-bold font-mono text-blue-700 mt-1">{metrics.percentage2FA}%</h4>
              <p className="text-[11px] text-blue-600 font-medium mt-0.5">{metrics.secured2FA} Secured with 2FA</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="erp-card p-4 relative overflow-hidden flex items-center justify-between border-l-4 border-l-amber-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unsecured 2FA</p>
              <h4 className="text-2xl font-bold font-mono text-amber-700 mt-1">{metrics.total - metrics.secured2FA}</h4>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">Pending 2FA Setup</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="py-24 text-center text-slate-500">
            <div className="w-10 h-10 border-4 border-[#2089C8] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-medium text-slate-600">Loading user accounts...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-md mx-auto shadow-sm">
            <div className="p-4 bg-sky-50 text-[#2089C8] rounded-2xl inline-block mb-3 border border-sky-100">
              <Users className="w-10 h-10" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">No Users Found</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              No user accounts match your search query.
            </p>
            {canCreate && (
              <button
                onClick={handleCreateNew}
                className="btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer shadow-sm"
              >
                + Create User Account
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Assigned Warehouses (ឃ្លាំង)</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Security (2FA)</th>
                    {(canEdit || canDelete) && (
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const primaryRole = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles[0] : (u.roleName || 'User');
                    const isUserActive = u.isActive !== false;
                    const isAdmin = Array.isArray(u.roles) && u.roles.some(r => String(r).toUpperCase().includes('ADMIN'));
                    const warehouseList = u.warehouseNames || [];

                    return (
                      <tr key={u.id} className="hover:bg-sky-50/40 transition-colors group">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1976ab] to-[#2089C8] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                              {u.username?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 text-xs">{u.username}</span>
                                {u.mustSetPassword && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-100 text-amber-800">
                                    Invite Pending
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-300" /> {u.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${
                            primaryRole.toUpperCase().includes('ADMIN')
                              ? 'bg-sky-50 text-[#155e89] border-sky-200'
                              : primaryRole.toUpperCase().includes('STOCK') || primaryRole.toUpperCase().includes('WAREHOUSE')
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {primaryRole}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {isAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              👑 គ្រប់ឃ្លាំងទាំងអស់ (All Warehouses)
                            </span>
                          ) : warehouseList.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[260px]">
                              {warehouseList.map((wName, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-sky-50 text-[#155e89] border border-sky-200">
                                  🏢 {wName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400 italic">
                              គ្មានឃ្លាំង (No Access)
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {u.mustSetPassword ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Send className="w-3 h-3 text-amber-600" /> Password Pending
                            </span>
                          ) : (
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              isUserActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {isUserActive ? 'Active' : 'Disabled'}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {u.twoFactorEnabled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <ShieldCheck className="w-3 h-3" /> Enabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <ShieldAlert className="w-3 h-3" /> Pending
                            </span>
                          )}
                        </td>

                        {(canEdit || canDelete) && (
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Invitation helper buttons */}
                              {u.mustSetPassword && (
                                <>
                                  {u.invitationLink && (
                                    <button
                                      onClick={() => handleCopyInviteLink(u.invitationLink)}
                                      className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                      title="Copy Setup Link"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleResendInvite(u)}
                                    className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                    title="Resend Invitation Email"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              {canEdit && (
                                <button
                                  onClick={() => handleToggleStatus(u.id)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    isUserActive 
                                      ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' 
                                      : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                  title={isUserActive ? 'Disable Account' : 'Enable Account'}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {canEdit && (
                                <button
                                  onClick={() => handleEditUser(u)}
                                  className="p-1.5 text-slate-500 hover:text-[#2089C8] hover:bg-sky-50 border border-transparent hover:border-sky-200 rounded-lg transition-colors cursor-pointer"
                                  title="Edit User & Permissions"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {canDelete && (
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                                  title="Delete User Account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <UserModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveUser}
        initialUser={selectedUser}
        mode={modalMode}
      />

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, user: null })}
        onConfirm={handleConfirmDelete}
        title="Delete User Account"
        message={`This will permanently remove user account @${deleteConfirm.user?.username}. Action cannot be undone.`}
        itemName={deleteConfirm.user ? `@${deleteConfirm.user.username} — ${deleteConfirm.user.email}` : ''}
        requireConfirmText={deleteConfirm.user?.username}
        confirmText="Delete Account"
        type="danger"
      />
    </div>
  );
};

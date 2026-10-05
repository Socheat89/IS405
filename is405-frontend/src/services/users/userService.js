import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';

// Permission ID → code lookup (for resolving effectivePermissions from roleIds without API call)
const PERM_FALLBACK = [
  { id: 2, code: 'stock.view' }, { id: 3, code: 'stock-items.view' },
  { id: 4, code: 'stock-items.create' }, { id: 5, code: 'stock-items.edit' },
  { id: 6, code: 'stock-items.delete' }, { id: 7, code: 'stock-in.view' },
  { id: 8, code: 'stock-in.create' }, { id: 9, code: 'stock-out.view' },
  { id: 10, code: 'stock-out.create' }, { id: 11, code: 'stock-adjustments.view' },
  { id: 12, code: 'stock-adjustments.create' }, { id: 13, code: 'stock-movements.view' },
  { id: 14, code: 'stock-alerts.view' }, { id: 18, code: 'users.view' },
  { id: 19, code: 'users.create' }, { id: 20, code: 'users.edit' },
  { id: 21, code: 'users.delete' }, { id: 25, code: 'roles.view' },
  { id: 26, code: 'roles.create' }, { id: 27, code: 'roles.edit' },
  { id: 28, code: 'permissions.view' }, { id: 30, code: 'settings.view' },
  { id: 31, code: 'purchases.view' }, { id: 32, code: 'purchase-orders.view' },
  { id: 33, code: 'purchase-orders.create' }, { id: 34, code: 'purchase-orders.approve' },
  { id: 35, code: 'purchase-orders.cancel' }, { id: 36, code: 'goods-receipts.view' },
  { id: 37, code: 'goods-receipts.create' }, { id: 38, code: 'purchase-returns.view' },
  { id: 39, code: 'purchase-returns.create' }, { id: 40, code: 'sales.view' },
  { id: 41, code: 'sales-orders.view' }, { id: 42, code: 'sales-orders.create' },
  { id: 43, code: 'sales-orders.confirm' }, { id: 44, code: 'sales-orders.cancel' },
  { id: 45, code: 'sales-orders.pay' }, { id: 46, code: 'sales-returns.view' },
  { id: 47, code: 'sales-returns.create' }, { id: 62, code: 'sales-returns.confirm' },
  { id: 48, code: 'warehouses.view' }, { id: 51, code: 'transfers.view' },
  { id: 52, code: 'transfers.create' }, { id: 59, code: 'reports.view' },
  { id: 60, code: 'audit.view' }
];

function resolvePermCodes(permissionIds) {
  if (!Array.isArray(permissionIds) || permissionIds.length === 0) return [];
  return permissionIds
    .map(id => PERM_FALLBACK.find(p => p.id === Number(id))?.code || null)
    .filter(Boolean);
}

/**
 * Enrich a UserDto from the API with `roles`, `roleIds`, `effectivePermissions`
 * for use by the AuthContext permission system.
 */
function enrichUser(apiUser) {
  if (!apiUser) return apiUser;
  const roleIds = apiUser.roleIds || [];
  const roles   = apiUser.roles   || [];
  const effectivePermissions =
    (apiUser.effectivePermissions || []).length > 0
      ? apiUser.effectivePermissions
      : resolvePermCodes(apiUser.directPermissionIds || []);
  return { ...apiUser, roles, roleIds, effectivePermissions };
}

export const userService = {
  /** GET /api/users — returns all users from the DB */
  async getUsers() {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.USERS.BASE);
    const data = response?.data;
    if (!Array.isArray(data)) throw new Error('Invalid response from users API');
    return data.map(enrichUser);
  },

  /** GET /api/users/me — returns current logged-in user profile */
  async getCurrentUser() {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.USERS.ME);
    return enrichUser(response.data);
  },

  /** POST /api/users */
  async createUser(userData) {
    const roleIds = (userData.roleIds || []).map(Number);
    const directPermissionIds = (userData.directPermissionIds || []).map(Number);
    const warehouseIds = (userData.warehouseIds || []).map(Number);

    const payload = {
      username: userData.username,
      email: userData.email,
      roleIds,
      directPermissionIds,
      warehouseIds,
      defaultWarehouseId: userData.defaultWarehouseId ? Number(userData.defaultWarehouseId) : null,
      sendInvitationEmail: userData.sendInvitationEmail !== false,
    };

    if (userData.password) {
      payload.password = userData.password;
    }

    const response = await apiClient.post(API_CONFIG.ENDPOINTS.USERS.BASE, payload);
    if (!response?.data) throw new Error('Failed to create user');
    return enrichUser(response.data);
  },

  /** POST /api/users/:id/resend-invitation */
  async resendInvitation(userId) {
    const response = await apiClient.post(API_CONFIG.ENDPOINTS.USERS.RESEND_INVITATION(userId));
    return response.data;
  },

  /** PUT /api/users/:id/roles */
  async updateUser(userId, userData) {
    const roleIds = (userData.roleIds || []).map(Number);
    const directPermissionIds = (userData.directPermissionIds || []).map(Number);
    const warehouseIds = (userData.warehouseIds || []).map(Number);

    const payload = { 
      roleIds, 
      directPermissionIds, 
      warehouseIds,
      defaultWarehouseId: userData.defaultWarehouseId ? Number(userData.defaultWarehouseId) : null
    };

    const response = await apiClient.put(API_CONFIG.ENDPOINTS.USERS.ROLES(userId), payload);
    if (!response?.data) throw new Error('Failed to update user');
    return enrichUser(response.data);
  },

  /** PUT /api/users/:id/status — toggle active/inactive */
  async toggleUserStatus(userId) {
    const response = await apiClient.put(API_CONFIG.ENDPOINTS.USERS.STATUS(userId));
    if (!response?.data) throw new Error('Failed to toggle user status');
    return enrichUser(response.data);
  },

  /** PUT /api/users/:id/2fa — toggle two factor authentication */
  async toggleTwoFactor(userId) {
    const response = await apiClient.put(API_CONFIG.ENDPOINTS.USERS.TOGGLE_2FA(userId));
    if (!response?.data) throw new Error('Failed to toggle 2FA status');
    return enrichUser(response.data);
  },

  /** DELETE /api/users/:id (uses /status toggle for "soft delete" if no DELETE endpoint) */
  async deleteUser(userId) {
    const response = await apiClient.delete(API_CONFIG.ENDPOINTS.USERS.USER_BY_ID(userId));
    // 200/204 = success
    return true;
  },
};

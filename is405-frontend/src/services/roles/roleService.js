import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';

// Permission ID → code lookup (used only for enriching UI display)
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

/** Resolve permission IDs → code strings */
export function resolvePermissionNames(permissionIds) {
  if (!Array.isArray(permissionIds) || permissionIds.length === 0) return [];
  return permissionIds
    .map(id => PERM_FALLBACK.find(p => p.id === Number(id))?.code || null)
    .filter(Boolean);
}

/** Enrich API RoleResponse with permissionNames for AuthContext */
function enrichRole(apiRole) {
  if (!apiRole) return apiRole;
  const permIds = apiRole.permissionIds || [];
  const resolvedNames = resolvePermissionNames(permIds);
  return {
    ...apiRole,
    permissionNames: resolvedNames.length > 0 ? resolvedNames : (apiRole.permissionNames || [])
  };
}

export const roleService = {
  /** GET /api/roles — returns all roles from the DB */
  async getRoles() {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.ROLES.BASE);
    const items = response?.data?.items || response?.data;
    if (!Array.isArray(items)) throw new Error('Invalid response from roles API');
    return items.map(enrichRole);
  },

  /** GET /api/roles/:id */
  async getRole(roleId) {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.ROLES.ROLE_BY_ID(roleId));
    if (!response?.data) throw new Error('Role not found');
    return enrichRole(response.data);
  },

  /** POST /api/roles */
  async createRole(roleData) {
    const payload = {
      name: roleData.name,
      code: (roleData.code || roleData.name || '').toUpperCase().replace(/\s+/g, '_'),
      description: roleData.description || '',
      permissionIds: roleData.permissionIds || [],
    };

    const response = await apiClient.post(API_CONFIG.ENDPOINTS.ROLES.BASE, payload);
    if (!response?.data) throw new Error('Failed to create role');
    const created = enrichRole(response.data);
    window.dispatchEvent(new Event('roles_updated'));
    return created;
  },

  /** PUT /api/roles/:id */
  async updateRole(roleId, roleData) {
    const payload = {
      name: roleData.name,
      description: roleData.description,
      permissionIds: roleData.permissionIds || [],
    };

    const response = await apiClient.put(API_CONFIG.ENDPOINTS.ROLES.ROLE_BY_ID(roleId), payload);
    if (!response?.data) throw new Error('Failed to update role');
    const updated = enrichRole(response.data);
    window.dispatchEvent(new Event('roles_updated'));
    return updated;
  },

  /** DELETE /api/roles/:id */
  async deleteRole(roleId) {
    await apiClient.delete(API_CONFIG.ENDPOINTS.ROLES.ROLE_BY_ID(roleId));
    window.dispatchEvent(new Event('roles_updated'));
    return true;
  },
};

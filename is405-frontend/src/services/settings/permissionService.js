import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';

// Comprehensive fallback list matching backend DbSeeder permDefinitions
const FALLBACK_PERMISSIONS = [
  // Stock
  { id: 2, pageCode: 'stock', pageName: 'Stock Management', code: 'stock.view', action: 'view', description: 'View stock overview' },
  { id: 3, pageCode: 'stock-items', pageName: 'Items Catalogue', code: 'stock-items.view', action: 'view', description: 'View stock item catalogue' },
  { id: 4, pageCode: 'stock-items', pageName: 'Items Catalogue', code: 'stock-items.create', action: 'create', description: 'Create new stock items' },
  { id: 5, pageCode: 'stock-items', pageName: 'Items Catalogue', code: 'stock-items.edit', action: 'edit', description: 'Edit stock items' },
  { id: 6, pageCode: 'stock-items', pageName: 'Items Catalogue', code: 'stock-items.delete', action: 'delete', description: 'Deactivate stock items' },
  { id: 7, pageCode: 'stock-in', pageName: 'Stock In', code: 'stock-in.view', action: 'view', description: 'View stock in receiving' },
  { id: 8, pageCode: 'stock-in', pageName: 'Stock In', code: 'stock-in.create', action: 'create', description: 'Record inward stock receipts' },
  { id: 9, pageCode: 'stock-out', pageName: 'Stock Out', code: 'stock-out.view', action: 'view', description: 'View stock out dispatch' },
  { id: 10, pageCode: 'stock-out', pageName: 'Stock Out', code: 'stock-out.create', action: 'create', description: 'Record outward stock dispatch' },
  { id: 11, pageCode: 'stock-adjustments', pageName: 'Adjustments', code: 'stock-adjustments.view', action: 'view', description: 'View stock adjustments' },
  { id: 12, pageCode: 'stock-adjustments', pageName: 'Adjustments', code: 'stock-adjustments.create', action: 'create', description: 'Record physical count adjustments' },
  { id: 13, pageCode: 'stock-movements', pageName: 'Movements Ledger', code: 'stock-movements.view', action: 'view', description: 'View stock movement ledger' },
  { id: 14, pageCode: 'stock-alerts', pageName: 'Low Stock Alerts', code: 'stock-alerts.view', action: 'view', description: 'View low stock alerts' },

  // Purchases
  { id: 31, pageCode: 'purchases', pageName: 'Purchasing', code: 'purchases.view', action: 'view', description: 'View purchases section' },
  { id: 32, pageCode: 'purchase-orders', pageName: 'Purchase Orders', code: 'purchase-orders.view', action: 'view', description: 'View purchase orders' },
  { id: 33, pageCode: 'purchase-orders', pageName: 'Purchase Orders', code: 'purchase-orders.create', action: 'create', description: 'Create purchase orders' },
  { id: 34, pageCode: 'purchase-orders', pageName: 'Purchase Orders', code: 'purchase-orders.approve', action: 'approve', description: 'Approve or reject purchase orders' },
  { id: 35, pageCode: 'purchase-orders', pageName: 'Purchase Orders', code: 'purchase-orders.cancel', action: 'cancel', description: 'Cancel purchase orders' },
  { id: 36, pageCode: 'goods-receipts', pageName: 'Goods Receipts', code: 'goods-receipts.view', action: 'view', description: 'View goods receipts' },
  { id: 37, pageCode: 'goods-receipts', pageName: 'Goods Receipts', code: 'goods-receipts.create', action: 'create', description: 'Process goods receiving (GRN)' },
  { id: 38, pageCode: 'purchase-returns', pageName: 'Purchase Returns', code: 'purchase-returns.view', action: 'view', description: 'View purchase returns' },
  { id: 39, pageCode: 'purchase-returns', pageName: 'Purchase Returns', code: 'purchase-returns.create', action: 'create', description: 'Process purchase returns' },

  // Sales
  { id: 40, pageCode: 'sales', pageName: 'Sales & Billing', code: 'sales.view', action: 'view', description: 'View sales section' },
  { id: 41, pageCode: 'sales-orders', pageName: 'Sales Orders', code: 'sales-orders.view', action: 'view', description: 'View sales orders and invoices' },
  { id: 42, pageCode: 'sales-orders', pageName: 'Sales Orders', code: 'sales-orders.create', action: 'create', description: 'Create sales orders' },
  { id: 43, pageCode: 'sales-orders', pageName: 'Sales Orders', code: 'sales-orders.confirm', action: 'confirm', description: 'Confirm sales & dispatch' },
  { id: 44, pageCode: 'sales-orders', pageName: 'Sales Orders', code: 'sales-orders.cancel', action: 'cancel', description: 'Cancel sales orders' },
  { id: 45, pageCode: 'sales-orders', pageName: 'Sales Orders', code: 'sales-orders.pay', action: 'pay', description: 'Record payments for invoices' },
  { id: 46, pageCode: 'sales-returns', pageName: 'Sales Returns', code: 'sales-returns.view', action: 'view', description: 'View customer returns' },
  { id: 47, pageCode: 'sales-returns', pageName: 'Sales Returns', code: 'sales-returns.create', action: 'create', description: 'Create customer return requests' },
  { id: 62, pageCode: 'sales-returns', pageName: 'Sales Returns', code: 'sales-returns.confirm', action: 'confirm', description: 'Confirm customer returns & restock warehouse' },

  // Warehouses
  { id: 48, pageCode: 'warehouses', pageName: 'Warehouses', code: 'warehouses.view', action: 'view', description: 'View warehouse overview' },
  { id: 51, pageCode: 'transfers', pageName: 'Stock Transfers', code: 'transfers.view', action: 'view', description: 'View stock transfers' },
  { id: 52, pageCode: 'transfers', pageName: 'Stock Transfers', code: 'transfers.create', action: 'create', description: 'Create and complete transfers' },

  // Users & Permissions
  { id: 18, pageCode: 'users', pageName: 'Users & Permissions', code: 'users.view', action: 'view', description: 'View user accounts' },
  { id: 19, pageCode: 'users', pageName: 'Users & Permissions', code: 'users.create', action: 'create', description: 'Create new user accounts' },
  { id: 20, pageCode: 'users', pageName: 'Users & Permissions', code: 'users.edit', action: 'edit', description: 'Edit user accounts and roles' },
  { id: 21, pageCode: 'users', pageName: 'Users & Permissions', code: 'users.delete', action: 'delete', description: 'Disable or remove user accounts' },
  { id: 25, pageCode: 'roles', pageName: 'System Roles', code: 'roles.view', action: 'view', description: 'View system authorization roles' },
  { id: 26, pageCode: 'roles', pageName: 'System Roles', code: 'roles.create', action: 'create', description: 'Create new system roles' },
  { id: 27, pageCode: 'roles', pageName: 'System Roles', code: 'roles.edit', action: 'edit', description: 'Edit system roles and permissions' },
  { id: 28, pageCode: 'permissions', pageName: 'Permissions', code: 'permissions.view', action: 'view', description: 'View system action permissions' },

  // Reports & Settings
  { id: 59, pageCode: 'reports', pageName: 'Analytics & Reports', code: 'reports.view', action: 'view', description: 'View reports and metrics' },
  { id: 60, pageCode: 'audit', pageName: 'Audit Logs', code: 'audit.view', action: 'view', description: 'View security audit logs' },
  { id: 30, pageCode: 'settings', pageName: 'Settings', code: 'settings.view', action: 'view', description: 'View settings workspace' }
];

export const permissionService = {
  async getAllPermissions() {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.PERMISSIONS.BASE);
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data;
      }
    } catch (error) {
      console.warn('Backend permissions endpoint unavailable, using standard permissions', error);
    }
    return FALLBACK_PERMISSIONS;
  },

  async getMyPermissions() {
    try {
      const response = await apiClient.get('/permissions/me');
      if (Array.isArray(response.data)) {
        return response.data;
      }
    } catch (error) {
      // Return empty if not authenticated or error
    }
    return [];
  }
};

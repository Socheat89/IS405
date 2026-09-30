// Service layer for Admin Control & System Settings
import apiClient from '../apiClient';

const DEFAULT_SETTINGS = {
  companyName: 'Mekong Stock Enterprise Co., Ltd.',
  currencySymbol: '$',
  currencyCode: 'USD',
  defaultLanguage: 'km',
  vatRatePercentage: 10,
  defaultWarehouseLocation: 'Main Warehouse - Phnom Penh',
  enforce2FAAllUsers: true,
  allow2FADisable: false,
  sessionTimeoutMinutes: 60,
  maxFailedLoginAttempts: 5,
  lockoutDurationMinutes: 15,
  mockModeEnabled: false,
  apiBaseUrl: 'http://localhost:5230/api',
  stockMicroserviceUrl: 'http://localhost:5230/api/stock',
  authMicroserviceUrl: 'http://localhost:5230/api/auth',
  purchaseMicroserviceUrl: 'http://localhost:5230/api/purchase',
  salesMicroserviceUrl: 'http://localhost:5230/api/sales',
};

export const settingsService = {
  /** GET /api/settings — loads system settings from DB, falls back to defaults */
  async getSettings() {
    try {
      const response = await apiClient.get('/settings');
      if (response?.data && typeof response.data === 'object') {
        return { ...DEFAULT_SETTINGS, ...response.data };
      }
    } catch (err) {
      console.warn('[settingsService] getSettings fallback to defaults:', err?.message);
    }
    return { ...DEFAULT_SETTINGS };
  },

  /** PUT /api/settings — saves system settings to DB */
  async saveSettings(newSettings) {
    const response = await apiClient.put('/settings', newSettings);
    return response?.data || newSettings;
  },

  /** GET /api/audit — loads audit logs from DB */
  async getAuditLogs(params = {}) {
    try {
      const response = await apiClient.get('/audit', { params });
      const data = response?.data?.items || response?.data;
      if (Array.isArray(data)) return data;
    } catch (err) {
      console.warn('[settingsService] getAuditLogs failed:', err?.message);
    }
    return [];
  },
};

import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';

export const stockItemService = {
  /** GET /api/stock/items */
  async getItems(params = {}) {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.STOCK.ITEMS, { params });
    const apiItems = response?.data?.items || response?.data;
    if (!Array.isArray(apiItems)) throw new Error('Invalid response from stock items API');

    let items = apiItems;
    // Client-side filtering (backend may not support all filters)
    if (params.search) {
      const s = params.search.toLowerCase();
      items = items.filter(i =>
        i.name?.toLowerCase().includes(s) ||
        i.sku?.toLowerCase().includes(s) ||
        i.location?.toLowerCase().includes(s)
      );
    }
    if (params.status && params.status !== 'ALL') {
      items = items.filter(i => i.status === params.status);
    }
    return items;
  },

  /** GET /api/stock/items/:id */
  async getItem(id) {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.STOCK.ITEM_BY_ID(id));
    if (!response?.data) throw new Error('Stock item not found');
    return response.data;
  },

  /** POST /api/stock/items */
  async createItem(itemData) {
    const response = await apiClient.post(API_CONFIG.ENDPOINTS.STOCK.ITEMS, itemData);
    if (!response?.data) throw new Error('Failed to create stock item');
    return response.data;
  },

  /** PUT /api/stock/items/:id */
  async updateItem(id, itemData) {
    const response = await apiClient.put(API_CONFIG.ENDPOINTS.STOCK.ITEM_BY_ID(id), itemData);
    if (!response?.data) throw new Error('Failed to update stock item');
    return response.data;
  },

  /** DELETE /api/stock/items/:id */
  async deleteItem(id) {
    await apiClient.delete(API_CONFIG.ENDPOINTS.STOCK.ITEM_BY_ID(id));
    return true;
  },

  /** POST /api/stock/items/:id/adjust */
  async adjustStock(itemId, adjustmentQuantity, reason) {
    const response = await apiClient.post(API_CONFIG.ENDPOINTS.STOCK.ADJUST(itemId), {
      adjustmentQuantity,
      reason,
    });
    return response?.data || true;
  },
};

// Keep backward-compatible exports used by stockInService / stockOutService
export function loadStock() { return []; }
export function saveStock() {}

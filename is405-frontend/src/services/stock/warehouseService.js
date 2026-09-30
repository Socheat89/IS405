import apiClient from '../apiClient';

export const warehouseService = {
  /** GET /warehouses */
  async getWarehouses(onlyActive = false) {
    const response = await apiClient.get('/warehouses', {
      params: { onlyActive }
    });
    return Array.isArray(response?.data) ? response.data : (response?.data?.items || []);
  },

  /** GET /warehouses/:id */
  async getWarehouseById(id) {
    const response = await apiClient.get(`/warehouses/${id}`);
    return response?.data;
  },

  /** POST /warehouses */
  async createWarehouse(warehouseData) {
    const response = await apiClient.post('/warehouses', warehouseData);
    return response?.data;
  },

  /** PUT /warehouses/:id */
  async updateWarehouse(id, warehouseData) {
    const response = await apiClient.put(`/warehouses/${id}`, warehouseData);
    return response?.data;
  },

  /** GET /inventory/stocks */
  async getWarehouseStocks(params = {}) {
    const response = await apiClient.get('/inventory/stocks', { params });
    return response?.data?.items || (Array.isArray(response?.data) ? response.data : []);
  }
};

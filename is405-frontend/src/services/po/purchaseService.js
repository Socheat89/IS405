import apiClient from '../apiClient';

export const purchaseService = {
  /** GET /purchases/orders */
  async getPurchaseOrders(params = {}) {
    const response = await apiClient.get('/purchases/orders', { params });
    const apiPOs = response?.data?.items || response?.data;
    if (!Array.isArray(apiPOs)) throw new Error('Invalid response from purchase orders API');

    let pos = apiPOs;
    if (params.search) {
      const s = params.search.toLowerCase();
      pos = pos.filter(p =>
        p.poNumber?.toLowerCase().includes(s) ||
        (p.vendorName || p.supplierName || '')?.toLowerCase().includes(s)
      );
    }
    if (params.status && params.status !== 'ALL') {
      pos = pos.filter(p => p.status === params.status);
    }
    return pos;
  },

  /** GET /purchases/orders/:id */
  async getPurchaseOrder(id) {
    const response = await apiClient.get(`/purchases/orders/${id}`);
    if (!response?.data) throw new Error('Purchase order not found');
    return response.data;
  },

  /** POST /purchases/orders */
  async createPurchaseOrder(poData) {
    const response = await apiClient.post('/purchases/orders', poData);
    if (!response?.data) throw new Error('Failed to create purchase order');
    return response.data;
  },

  /** PUT /purchases/orders/:id */
  async updatePurchaseOrder(id, poData) {
    const response = await apiClient.put(`/purchases/orders/${id}`, poData);
    if (!response?.data) throw new Error('Failed to update purchase order');
    return response.data;
  },

  /** POST /purchases/orders/:id/approve */
  async approveOrder(poId, approvalData = null) {
    const response = await apiClient.post(`/purchases/orders/${poId}/approve`, approvalData || {});
    return response?.data || { success: true };
  },

  /** POST /purchases/orders/:id/reject */
  async rejectOrder(poId, reason) {
    const response = await apiClient.post(`/purchases/orders/${poId}/reject`, { reason });
    return response?.data || { success: true };
  },

  /** POST /purchases/orders/:id/cancel */
  async cancelOrder(poId, reason) {
    const response = await apiClient.post(`/purchases/orders/${poId}/cancel`, { reason });
    return response?.data || { success: true };
  },

  /** PATCH /purchases/orders/:id/status */
  async updatePOStatus(poId, newStatus) {
    const response = await apiClient.patch(`/purchases/orders/${poId}/status`, { status: newStatus });
    return response?.data || { success: true };
  },

  /** POST /purchases/grn — Goods Receipt Note */
  async processGoodsReceipt(grnData) {
    const response = await apiClient.post('/purchases/grn', grnData);
    return response?.data || { success: true };
  },

  /** DELETE /purchases/orders/:id */
  async deletePurchaseOrder(id) {
    await apiClient.delete(`/purchases/orders/${id}`);
    return true;
  },

  /** GET /suppliers */
  async getSuppliers() {
    try {
      const response = await apiClient.get('/suppliers', { params: { pageSize: 100 } });
      const list = response?.data?.items || (Array.isArray(response?.data) ? response.data : []);
      return list;
    } catch {
      return [];
    }
  },

  /** GET /warehouses */
  async getWarehouses() {
    try {
      const response = await apiClient.get('/warehouses', { params: { onlyActive: true } });
      return Array.isArray(response?.data) ? response.data : (response?.data?.items || []);
    } catch {
      return [];
    }
  },
};

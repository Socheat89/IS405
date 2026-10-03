import apiClient from '../apiClient';

export const salesService = {
  /** GET /sales/orders */
  async getSalesOrders(params = {}) {
    const response = await apiClient.get('/sales/orders', { params });
    const raw = response?.data;
    const apiOrders = Array.isArray(raw) ? raw : (raw?.items || raw?.Items || []);

    let orders = apiOrders;
    if (params.search) {
      const s = params.search.toLowerCase();
      orders = orders.filter(so =>
        (so.soNumber || so.invoiceNumber)?.toLowerCase().includes(s) ||
        so.customerName?.toLowerCase().includes(s)
      );
    }
    if (params.status && params.status !== 'ALL') {
      orders = orders.filter(so => so.status === params.status);
    }
    return orders;
  },

  /** GET /sales/orders/:id */
  async getSalesOrder(id) {
    const response = await apiClient.get(`/sales/orders/${id}`);
    if (!response?.data) throw new Error('Sales order not found');
    return response.data;
  },

  /** POST /sales/orders */
  async createSalesOrder(soData) {
    // If not specified, autoConfirm defaults to false (save first, confirm upon dispatch)
    const payload = {
      autoConfirm: false,
      ...soData
    };
    const response = await apiClient.post('/sales/orders', payload);
    if (!response?.data) throw new Error('Failed to create sales order');
    return response.data;
  },

  /** PUT /sales/orders/:id */
  async updateSalesOrder(id, soData) {
    const response = await apiClient.put(`/sales/orders/${id}`, soData);
    if (!response?.data) throw new Error('Failed to update sales order');
    return response.data;
  },

  /** POST /sales/orders/:id/confirm -> Performs Stock OUT */
  async confirmSalesOrder(id) {
    const response = await apiClient.post(`/sales/orders/${id}/confirm`);
    return response?.data || { success: true };
  },

  /** PATCH /sales/orders/:id/status */
  async updateSalesStatus(soId, newStatus) {
    if (newStatus === 'CONFIRMED' || newStatus === 'SALES_ORDER') {
      return await this.confirmSalesOrder(soId);
    }
    const response = await apiClient.patch(`/sales/orders/${soId}/status`, { status: newStatus });
    return response?.data || { success: true };
  },

  /** DELETE /sales/orders/:id */
  async deleteSalesOrder(id) {
    await apiClient.delete(`/sales/orders/${id}`);
    return true;
  },

  /** GET /sales/returns */
  async getSalesReturns(params = {}) {
    const response = await apiClient.get('/sales/returns', { params });
    const raw = response?.data;
    return Array.isArray(raw) ? raw : (raw?.items || raw?.Items || []);
  },

  /** GET /sales/returns/:id */
  async getSalesReturn(id) {
    const response = await apiClient.get(`/sales/returns/${id}`);
    return response?.data;
  },

  /** POST /sales/returns -> Restocks inventory (Stock IN) */
  async createSalesReturn(returnData) {
    const response = await apiClient.post('/sales/returns', returnData);
    if (!response?.data) throw new Error('Failed to process sales return');
    return response.data;
  },
};

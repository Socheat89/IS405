import apiClient from '../apiClient';

export const salesService = {
  /** GET /sales/orders */
  async getSalesOrders(params = {}) {
    const response = await apiClient.get('/sales/orders', { params });
    const apiOrders = response?.data?.items || response?.data;
    if (!Array.isArray(apiOrders)) throw new Error('Invalid response from sales orders API');

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
    const response = await apiClient.post('/sales/orders', soData);
    if (!response?.data) throw new Error('Failed to create sales order');
    return response.data;
  },

  /** PUT /sales/orders/:id */
  async updateSalesOrder(id, soData) {
    const response = await apiClient.put(`/sales/orders/${id}`, soData);
    if (!response?.data) throw new Error('Failed to update sales order');
    return response.data;
  },

  /** PATCH /sales/orders/:id/status */
  async updateSalesStatus(soId, newStatus) {
    const response = await apiClient.patch(`/sales/orders/${soId}/status`, { status: newStatus });
    return response?.data || { success: true };
  },

  /** DELETE /sales/orders/:id */
  async deleteSalesOrder(id) {
    await apiClient.delete(`/sales/orders/${id}`);
    return true;
  },
};

import apiClient from '../apiClient';

export const salesService = {
  /** GET /sales/orders */
  async getSalesOrders(params = {}) {
    const apiParams = { ...params };
    // Let frontend handle alias status matching (CONFIRMED/SALES_ORDER, QUOTATION/DRAFT)
    if (apiParams.status && apiParams.status !== 'ALL') {
      delete apiParams.status;
    }

    const response = await apiClient.get('/sales/orders', { params: apiParams });
    const raw = response?.data;
    const apiOrders = Array.isArray(raw) ? raw : (raw?.items || raw?.Items || []);

    const formatDateStr = (dateVal, fallbackDays = 0) => {
      if (!dateVal && fallbackDays === 0) return '';
      try {
        const d = dateVal ? new Date(dateVal) : new Date(Date.now() + fallbackDays * 86400000);
        if (isNaN(d.getTime())) return dateVal || '';
        return d.toISOString().substring(0, 10);
      } catch {
        return dateVal || '';
      }
    };

    let orders = apiOrders.map(so => {
      const saleDate = so.saleDateUtc || so.orderDate || so.createdAtUtc;
      const orderDate = formatDateStr(saleDate) || new Date().toISOString().substring(0, 10);
      const deliveryDate = so.deliveryDate 
        ? formatDateStr(so.deliveryDate)
        : (saleDate ? formatDateStr(new Date(new Date(saleDate).getTime() + 7 * 86400000)) : formatDateStr(null, 7));

      return {
        ...so,
        soNumber: so.invoiceNumber || so.soNumber,
        orderDate,
        deliveryDate,
      };
    });

    if (params.search) {
      const s = params.search.toLowerCase();
      orders = orders.filter(so =>
        (so.soNumber || so.invoiceNumber)?.toLowerCase().includes(s) ||
        so.customerName?.toLowerCase().includes(s)
      );
    }

    if (params.status && params.status !== 'ALL') {
      const target = params.status.toUpperCase();
      orders = orders.filter(so => {
        const st = (so.status || '').toUpperCase();
        if (target === 'CONFIRMED' || target === 'SALES_ORDER') {
          return st === 'CONFIRMED' || st === 'SALES_ORDER';
        }
        if (target === 'QUOTATION' || target === 'DRAFT') {
          return st === 'QUOTATION' || st === 'DRAFT' || st === 'PENDING';
        }
        if (target === 'DELIVERED') {
          return st === 'DELIVERED' || st === 'COMPLETED';
        }
        return st === target;
      });
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

  /** POST /sales/orders/:id/confirm -> Validates warehouse stock and confirms sales order */
  async confirmSalesOrder(id) {
    const response = await apiClient.post(`/sales/orders/${id}/confirm`);
    return response?.data || { success: true };
  },

  /** POST /sales/orders/:id/deliver -> Dispatches order & deducts Stock OUT from the designated warehouse */
  async deliverSalesOrder(id, warehouseId) {
    const response = await apiClient.post(`/sales/orders/${id}/deliver`, null, {
      params: warehouseId ? { warehouseId } : {}
    });
    return response?.data || { success: true };
  },

  /** PATCH /sales/orders/:id/status */
  async updateSalesStatus(soId, newStatus, warehouseId) {
    if (newStatus === 'CONFIRMED' || newStatus === 'SALES_ORDER') {
      return await this.confirmSalesOrder(soId);
    }
    if (newStatus === 'DELIVERED') {
      return await this.deliverSalesOrder(soId, warehouseId);
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

  /** POST /sales/returns -> Creates pending customer return request */
  async createSalesReturn(returnData) {
    const response = await apiClient.post('/sales/returns', returnData);
    if (!response?.data) throw new Error('Failed to create sales return');
    return response.data;
  },

  /** POST /sales/returns/:id/confirm -> Confirms return & Restocks inventory (Stock IN) */
  async confirmSalesReturn(id, warehouseId = null) {
    const response = await apiClient.post(`/sales/returns/${id}/confirm`, null, {
      params: warehouseId ? { warehouseId } : {}
    });
    if (!response?.data) throw new Error('Failed to confirm sales return');
    return response.data;
  },

  /** POST /sales/returns/:id/cancel -> Cancels sales return request */
  async cancelSalesReturn(id, reason = '') {
    const response = await apiClient.post(`/sales/returns/${id}/cancel`, { reason });
    if (!response?.data) throw new Error('Failed to cancel sales return');
    return response.data;
  },
};

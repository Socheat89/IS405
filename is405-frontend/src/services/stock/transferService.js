import apiClient from '../apiClient';

export const transferService = {
  /** GET /transfers */
  async getTransfers(params = {}) {
    const response = await apiClient.get('/transfers', { params });
    const data = response?.data?.items || (Array.isArray(response?.data) ? response.data : []);
    return data;
  },

  /** POST /transfers */
  async createTransfer(transferData) {
    const response = await apiClient.post('/transfers', transferData);
    return response?.data;
  },

  /** POST /transfers/:id/complete */
  async completeTransfer(id) {
    const response = await apiClient.post(`/transfers/${id}/complete`);
    return response?.data;
  },

  /** POST /transfers/:id/cancel */
  async cancelTransfer(id) {
    const response = await apiClient.post(`/transfers/${id}/cancel`);
    return response?.data;
  }
};

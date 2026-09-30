// Stock Category Service — warehouse categories management
import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';

export const stockCategoryService = {
  async getCategories() {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.STOCK.CATEGORIES);
      if (response?.data && Array.isArray(response.data)) return response.data;
    } catch (error) {
      // Fallback
    }
    return [
      { id: 1, name: 'Electronics',    code: 'ELEC' },
      { id: 2, name: 'Accessories',    code: 'ACC'  },
      { id: 3, name: 'Office Supplies',code: 'OFF'  },
      { id: 4, name: 'General',        code: 'GEN'  }
    ];
  }
};

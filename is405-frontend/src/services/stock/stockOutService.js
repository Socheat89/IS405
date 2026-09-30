// Stock Out Service — Outbound stock ledger (strictly populated via Sales Orders)
import apiClient from '../apiClient';

export const stockOutService = {
  /** GET Outbound stock movements */
  async getStockOutRecords(params = {}) {
    try {
      const response = await apiClient.get('/inventory/movements', {
        params: { movementType: 'OUT', ...params }
      });
      const items = response?.data?.items || (Array.isArray(response?.data) ? response.data : []);
      return items.map(m => ({
        id: m.id,
        referenceNo: m.referenceNo,
        referenceType: m.referenceType,
        warehouseName: m.warehouseName || 'Main Warehouse',
        itemId: m.productId || m.itemId,
        sku: m.productSku || m.itemSku || 'N/A',
        itemName: m.productName || m.itemName || 'Item',
        quantityDispatched: m.quantity,
        unitPrice: m.unitPrice,
        totalValue: (m.quantity || 0) * (m.unitPrice || 0),
        customer: m.supplierOrRecipient || 'Customer',
        soReference: m.referenceNo || 'SO',
        notes: m.notes || m.reason,
        dispatchedBy: m.createdByUsername || 'System',
        createdAt: m.createdAtUtc
      }));
    } catch {
      // Fallback to stock/movements endpoint if needed
      const response = await apiClient.get('/stock/movements', {
        params: { type: 'OUT' }
      });
      const data = Array.isArray(response?.data) ? response.data : [];
      return data.map(m => ({
        id: m.id,
        referenceNo: m.referenceNo,
        warehouseName: 'Main Warehouse',
        itemId: m.itemId,
        sku: m.itemSku,
        itemName: m.itemName,
        quantityDispatched: m.quantity,
        unitPrice: m.unitPrice,
        totalValue: (m.quantity || 0) * (m.unitPrice || 0),
        customer: m.supplierOrRecipient || 'Customer',
        soReference: m.referenceNo,
        notes: m.notes || m.reason,
        dispatchedBy: m.createdByUsername || 'System',
        createdAt: m.createdAtUtc
      }));
    }
  }
};

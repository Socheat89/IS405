// Stock In Service — Inbound stock ledger (strictly populated via Purchase Orders / GRN)
import apiClient from '../apiClient';

export const stockInService = {
  /** GET Inbound stock movements */
  async getStockInRecords(params = {}) {
    try {
      const response = await apiClient.get('/inventory/movements', {
        params: { movementType: 'IN', ...params }
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
        quantityReceived: m.quantity,
        unitCost: m.unitPrice,
        totalCost: (m.quantity || 0) * (m.unitPrice || 0),
        supplier: m.supplierOrRecipient || 'Supplier',
        poReference: m.referenceNo || 'PO',
        notes: m.notes || m.reason,
        recordedBy: m.createdByUsername || 'System',
        createdAt: m.createdAtUtc
      }));
    } catch {
      // Fallback to stock/movements endpoint if needed
      const response = await apiClient.get('/stock/movements', {
        params: { type: 'IN' }
      });
      const data = Array.isArray(response?.data) ? response.data : [];
      return data.map(m => ({
        id: m.id,
        referenceNo: m.referenceNo,
        warehouseName: 'Main Warehouse',
        itemId: m.itemId,
        sku: m.itemSku,
        itemName: m.itemName,
        quantityReceived: m.quantity,
        unitCost: m.unitPrice,
        totalCost: (m.quantity || 0) * (m.unitPrice || 0),
        supplier: m.supplierOrRecipient || 'Supplier',
        poReference: m.referenceNo,
        notes: m.notes || m.reason,
        recordedBy: m.createdByUsername || 'System',
        createdAt: m.createdAtUtc
      }));
    }
  }
};

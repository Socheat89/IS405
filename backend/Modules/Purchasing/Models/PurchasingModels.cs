using backend.Models.Data;
using backend.Modules.Inventory.Models;
using backend.Modules.Suppliers.Models;

namespace backend.Modules.Purchasing.Models;

public class PurchaseOrder
{
    public int Id { get; set; }
    public required string PoNumber { get; set; } // e.g. PO-202609-0001
    public int SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
    public int? WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }
    public DateTimeOffset OrderDateUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ExpectedDateUtc { get; set; }
    public string PaymentTerms { get; set; } = "Net 30";
    public string Status { get; set; } = "DRAFT"; // DRAFT, PENDING_APPROVAL, APPROVED, PARTIALLY_RECEIVED, RECEIVED, CLOSED, CANCELLED, REJECTED
    public decimal Subtotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Discount { get; set; }
    public decimal TotalAmount { get; set; }
    public string? Notes { get; set; }
    public int? CreatedByUserId { get; set; }
    public string? CreatedByUsername { get; set; }
    public int? ApprovedByUserId { get; set; }
    public string? ApprovedByUsername { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAtUtc { get; set; }
    public ICollection<PurchaseOrderItem> Items { get; set; } = [];
    public ICollection<GoodsReceipt> GoodsReceipts { get; set; } = [];
}

public class PurchaseOrderItem
{
    public int Id { get; set; }
    public int PurchaseOrderId { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }
    public int ProductId { get; set; }
    public StockItem? Product { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal Discount { get; set; }
    public decimal Tax { get; set; }
    public decimal Subtotal { get; set; }
    public int ReceivedQuantity { get; set; }
}

public class GoodsReceipt
{
    public int Id { get; set; }
    public required string GrnNumber { get; set; } // e.g. GRN-202609-0001
    public int PurchaseOrderId { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }
    public int? WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }
    public DateTimeOffset ReceivedDateUtc { get; set; } = DateTimeOffset.UtcNow;
    public int? ReceivedByUserId { get; set; }
    public string? ReceivedByUsername { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public ICollection<GoodsReceiptItem> Items { get; set; } = [];
}

public class GoodsReceiptItem
{
    public int Id { get; set; }
    public int GoodsReceiptId { get; set; }
    public GoodsReceipt? GoodsReceipt { get; set; }
    public int ProductId { get; set; }
    public StockItem? Product { get; set; }
    public int OrderedQuantity { get; set; }
    public int ReceivedQuantity { get; set; }
    public int DamagedQuantity { get; set; }
    public int AcceptedQuantity { get; set; }
    public int RejectedQuantity { get; set; }
    public decimal UnitCost { get; set; }
    public string? Remarks { get; set; }
}

public class PurchaseReturn
{
    public int Id { get; set; }
    public required string ReturnNumber { get; set; } // e.g. PR-202609-0001
    public int SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
    public int? PurchaseOrderId { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }
    public int? WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }
    public DateTimeOffset ReturnDateUtc { get; set; } = DateTimeOffset.UtcNow;
    public string Status { get; set; } = "COMPLETED"; // DRAFT, COMPLETED, CANCELLED
    public decimal TotalRefundAmount { get; set; }
    public string? Reason { get; set; }
    public string? Notes { get; set; }
    public int? CreatedByUserId { get; set; }
    public string? CreatedByUsername { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public ICollection<PurchaseReturnItem> Items { get; set; } = [];
}

public class PurchaseReturnItem
{
    public int Id { get; set; }
    public int PurchaseReturnId { get; set; }
    public PurchaseReturn? PurchaseReturn { get; set; }
    public int ProductId { get; set; }
    public StockItem? Product { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal Subtotal { get; set; }
    public string? DefectReason { get; set; }
}

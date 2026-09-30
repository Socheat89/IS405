namespace backend.Modules.Purchasing.DTOs;

public record PurchaseOrderDto(
    int Id,
    string PoNumber,
    int SupplierId,
    string SupplierName,
    int? WarehouseId,
    string? WarehouseName,
    DateTimeOffset OrderDateUtc,
    DateTimeOffset? ExpectedDateUtc,
    string PaymentTerms,
    string Status,
    decimal Subtotal,
    decimal Tax,
    decimal Discount,
    decimal TotalAmount,
    string? Notes,
    string? CreatedByUsername,
    string? ApprovedByUsername,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? UpdatedAtUtc,
    IReadOnlyList<PurchaseOrderItemDto> Items
);

public record PurchaseOrderItemDto(
    int Id,
    int ProductId,
    string ProductSku,
    string ProductName,
    int Quantity,
    decimal UnitCost,
    decimal Discount,
    decimal Tax,
    decimal Subtotal,
    int ReceivedQuantity,
    int RemainingQuantity
);

public record CreatePoRequest(
    int SupplierId,
    int? WarehouseId,
    DateTimeOffset? ExpectedDateUtc,
    string? PaymentTerms,
    decimal Tax,
    decimal Discount,
    string? Notes,
    IReadOnlyList<CreatePoItemRequest> Items
);

public record CreatePoItemRequest(
    int ProductId,
    int Quantity,
    decimal UnitCost,
    decimal Discount,
    decimal Tax
);

public record UpdatePoRequest(
    DateTimeOffset? ExpectedDateUtc,
    string? PaymentTerms,
    decimal Tax,
    decimal Discount,
    string? Notes,
    IReadOnlyList<CreatePoItemRequest> Items
);

public record GoodsReceiptDto(
    int Id,
    string GrnNumber,
    int PurchaseOrderId,
    string PoNumber,
    int? WarehouseId,
    string? WarehouseName,
    DateTimeOffset ReceivedDateUtc,
    string? ReceivedByUsername,
    string? Notes,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyList<GoodsReceiptItemDto> Items
);

public record GoodsReceiptItemDto(
    int Id,
    int ProductId,
    string ProductSku,
    string ProductName,
    int OrderedQuantity,
    int ReceivedQuantity,
    int DamagedQuantity,
    int AcceptedQuantity,
    int RejectedQuantity,
    decimal UnitCost,
    string? Remarks
);

public record CreateGrnRequest(
    int PurchaseOrderId,
    int? WarehouseId,
    string? Notes,
    IReadOnlyList<CreateGrnItemRequest> Items
);

public record CreateGrnItemRequest(
    int ProductId,
    int ReceivedQuantity,
    int DamagedQuantity,
    string? Remarks
);

public record PurchaseReturnDto(
    int Id,
    string ReturnNumber,
    int SupplierId,
    string SupplierName,
    int? PurchaseOrderId,
    string? PoNumber,
    int? WarehouseId,
    string? WarehouseName,
    DateTimeOffset ReturnDateUtc,
    string Status,
    decimal TotalRefundAmount,
    string? Reason,
    string? Notes,
    string? CreatedByUsername,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyList<PurchaseReturnItemDto> Items
);

public record PurchaseReturnItemDto(
    int Id,
    int ProductId,
    string ProductSku,
    string ProductName,
    int Quantity,
    decimal UnitCost,
    decimal Subtotal,
    string? DefectReason
);

public record CreatePurchaseReturnRequest(
    int SupplierId,
    int? PurchaseOrderId,
    int? WarehouseId,
    string Reason,
    string? Notes,
    IReadOnlyList<CreatePurchaseReturnItemRequest> Items
);

public record CreatePurchaseReturnItemRequest(
    int ProductId,
    int Quantity,
    decimal UnitCost,
    string? DefectReason
);

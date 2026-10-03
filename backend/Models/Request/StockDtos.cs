namespace backend.Models.Request;

public record CreateStockItemRequest(
    string? Sku,
    string? Barcode,
    string Name,
    string? Description,
    int? CategoryId,
    string? CategoryName,
    string? Unit,
    decimal? CostPrice,
    decimal? SellingPrice,
    decimal? UnitPrice,
    int? InitialQuantity,
    int? QuantityOnHand,
    int? MinStockLevel,
    int? ReorderLevel,
    string? Location
);

public record UpdateStockItemRequest(
    string? Sku,
    string? Barcode,
    string? Name,
    string? Description,
    int? CategoryId,
    string? CategoryName,
    string? Unit,
    decimal? CostPrice,
    decimal? SellingPrice,
    decimal? UnitPrice,
    int? QuantityOnHand,
    int? MinStockLevel,
    int? ReorderLevel,
    string? Location,
    bool? IsActive
);

public record StockAdjustmentItemRequest(
    int? AdjustmentQuantity,
    int? NewQuantity,
    string? Reason,
    string? Notes
);

public record StockInRequest(
    int ItemId,
    int Quantity,
    decimal? UnitCost,
    string? ReferenceNo,
    string? Supplier,
    string? Notes
);

public record StockOutRequest(
    int ItemId,
    int Quantity,
    string? ReferenceNo,
    string? DestinationOrCustomer,
    string Reason, // "Sale", "Damage", "Transfer", "Expired", "Internal Use"
    string? Notes
);

public record StockAdjustmentRequest(
    int ItemId,
    int NewQuantity,
    string Reason, // "Stocktake Count Discrepancy", "Damaged", "Loss/Theft", "Found Items", "Correction"
    string? Notes
);

public record StockItemResponse(
    int Id,
    string Sku,
    string? Barcode,
    string Name,
    string? Description,
    int? CategoryId,
    string? CategoryName,
    string Unit,
    decimal CostPrice,
    decimal SellingPrice,
    decimal UnitPrice,
    int QuantityOnHand,
    int MinStockLevel,
    int ReorderLevel,
    string? Location,
    bool IsActive,
    string Status, // "InStock", "LowStock", "OutOfStock"
    DateTimeOffset CreatedAtUtc
);

public record StockMovementResponse(
    int Id,
    string ReferenceNo,
    string MovementType,
    int ItemId,
    string ItemSku,
    string ItemName,
    int Quantity,
    decimal UnitPrice,
    int BalanceBefore,
    int BalanceAfter,
    string? Reason,
    string? SupplierOrRecipient,
    string? Notes,
    string? CreatedByUsername,
    DateTimeOffset CreatedAtUtc
);

public record StockSummaryResponse(
    int TotalItems,
    int TotalQuantity,
    decimal TotalInventoryValue,
    int LowStockCount,
    int OutOfStockCount,
    int TodayMovementsCount,
    int TodayInCount,
    int TodayOutCount
);

namespace backend.Modules.Inventory.DTOs;

public record WarehouseDto(
    int Id,
    string Code,
    string Name,
    string? Location,
    string? ContactPhone,
    bool IsActive,
    DateTimeOffset CreatedAtUtc
);

public record CreateWarehouseRequest(
    string Code,
    string Name,
    string? Location,
    string? ContactPhone
);

public record UpdateWarehouseRequest(
    string Name,
    string? Location,
    string? ContactPhone,
    bool IsActive
);

public record WarehouseStockDto(
    int Id,
    int WarehouseId,
    string WarehouseName,
    int ProductId,
    string ProductSku,
    string ProductName,
    int QuantityOnHand,
    int ReservedQuantity,
    int AvailableQuantity,
    DateTimeOffset UpdatedAtUtc
);

public record StockMovementDto(
    int Id,
    string ReferenceNo,
    string MovementType,
    string? ReferenceType,
    int? WarehouseId,
    string? WarehouseName,
    int ProductId,
    string ProductSku,
    string ProductName,
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

public record CreateAdjustmentRequest(
    int WarehouseId,
    int ProductId,
    string AdjustmentType, // SURPLUS, SHRINKAGE, DAMAGE, AUDIT
    int NewQuantity,
    string Reason,
    string? Notes
);

public record StockAdjustmentDto(
    int Id,
    string AdjustmentNo,
    int WarehouseId,
    string WarehouseName,
    int ProductId,
    string ProductSku,
    string ProductName,
    string AdjustmentType,
    int QuantityBefore,
    int QuantityAdjusted,
    int QuantityAfter,
    decimal UnitCost,
    string Reason,
    string? Notes,
    string? CreatedByUsername,
    DateTimeOffset CreatedAtUtc
);

public record CreateTransferRequest(
    int FromWarehouseId,
    int ToWarehouseId,
    string? Notes,
    IReadOnlyList<TransferItemRequest> Items
);

public record TransferItemRequest(
    int ProductId,
    int Quantity
);

public record StockTransferDto(
    int Id,
    string TransferNo,
    int FromWarehouseId,
    string FromWarehouseName,
    int ToWarehouseId,
    string ToWarehouseName,
    string Status,
    string? Notes,
    string? CreatedByUsername,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? CompletedAtUtc,
    IReadOnlyList<StockTransferItemDto> Items
);

public record StockTransferItemDto(
    int Id,
    int ProductId,
    string ProductSku,
    string ProductName,
    int Quantity
);

public record StockAlertDto(
    int ProductId,
    string ProductSku,
    string ProductName,
    int QuantityOnHand,
    int MinStockLevel,
    int MaxStockLevel,
    string Status // OutOfStock, LowStock
);

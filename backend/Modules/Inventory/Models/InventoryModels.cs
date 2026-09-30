using backend.Models.Data;

namespace backend.Modules.Inventory.Models;

public class Warehouse
{
    public int Id { get; set; }
    public required string Code { get; set; } // e.g. WH-MAIN, WH-BR1
    public required string Name { get; set; }
    public string? Location { get; set; }
    public string? ContactPhone { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public ICollection<WarehouseStock> Stocks { get; set; } = [];
}

public class WarehouseStock
{
    public int Id { get; set; }
    public int WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }
    public int ProductId { get; set; }
    public StockItem? Product { get; set; }
    public int QuantityOnHand { get; set; }
    public int ReservedQuantity { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

public class StockAdjustment
{
    public int Id { get; set; }
    public required string AdjustmentNo { get; set; } // e.g. ADJ-202609-001
    public int WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }
    public int ProductId { get; set; }
    public StockItem? Product { get; set; }
    public required string AdjustmentType { get; set; } // SURPLUS, SHRINKAGE, DAMAGE, AUDIT
    public int QuantityBefore { get; set; }
    public int QuantityAdjusted { get; set; } // can be positive or negative
    public int QuantityAfter { get; set; }
    public decimal UnitCost { get; set; }
    public required string Reason { get; set; }
    public string? Notes { get; set; }
    public int? CreatedByUserId { get; set; }
    public string? CreatedByUsername { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

public class StockTransfer
{
    public int Id { get; set; }
    public required string TransferNo { get; set; } // e.g. TR-202609-001
    public int FromWarehouseId { get; set; }
    public Warehouse? FromWarehouse { get; set; }
    public int ToWarehouseId { get; set; }
    public Warehouse? ToWarehouse { get; set; }
    public string Status { get; set; } = "PENDING"; // PENDING, COMPLETED, CANCELLED
    public string? Notes { get; set; }
    public int? CreatedByUserId { get; set; }
    public string? CreatedByUsername { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAtUtc { get; set; }
    public ICollection<StockTransferItem> Items { get; set; } = [];
}

public class StockTransferItem
{
    public int Id { get; set; }
    public int StockTransferId { get; set; }
    public StockTransfer? StockTransfer { get; set; }
    public int ProductId { get; set; }
    public StockItem? Product { get; set; }
    public int Quantity { get; set; }
}

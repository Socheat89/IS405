namespace backend.Models.Data;

public class StockMovement
{
    public int Id { get; set; }
    public required string ReferenceNo { get; set; }
    public required string MovementType { get; set; } // "IN", "OUT", "ADJUSTMENT", "TRANSFER", "RETURN"
    public string? ReferenceType { get; set; } // "PO", "GRN", "SALE", "ADJUSTMENT", "TRANSFER", "RETURN", "INITIAL"
    public int? WarehouseId { get; set; }
    public int ItemId { get; set; }
    public StockItem? Item { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public int BalanceBefore { get; set; }
    public int BalanceAfter { get; set; }
    public string? Reason { get; set; }
    public string? SupplierOrRecipient { get; set; }
    public string? Notes { get; set; }
    public int? CreatedByUserId { get; set; }
    public string? CreatedByUsername { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

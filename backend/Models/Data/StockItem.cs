namespace backend.Models.Data;

public class StockItem
{
    public int Id { get; set; }
    public required string Sku { get; set; }
    public string? Barcode { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public int? CategoryId { get; set; }
    public StockCategory? Category { get; set; }
    public string Unit { get; set; } = "PCS";
    public decimal CostPrice { get; set; }
    public decimal SellingPrice { get; set; }
    public int QuantityOnHand { get; set; }
    public int MinStockLevel { get; set; } = 10;
    public int MaxStockLevel { get; set; } = 100;
    public string? Brand { get; set; }
    public string? Location { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAtUtc { get; set; }
    public ICollection<StockMovement> Movements { get; set; } = [];
}

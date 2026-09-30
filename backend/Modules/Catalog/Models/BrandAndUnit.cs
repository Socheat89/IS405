namespace backend.Modules.Catalog.Models;

public class Brand
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

public class UnitOfMeasure
{
    public int Id { get; set; }
    public required string Code { get; set; } // PCS, BOX, KG, LTR, MTR
    public required string Name { get; set; }
    public bool IsActive { get; set; } = true;
}

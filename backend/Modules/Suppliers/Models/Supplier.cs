namespace backend.Modules.Suppliers.Models;

public class Supplier
{
    public int Id { get; set; }
    public required string SupplierCode { get; set; } // e.g. SUP-001
    public required string Name { get; set; }
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string PaymentTerms { get; set; } = "Net 30";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAtUtc { get; set; }
}

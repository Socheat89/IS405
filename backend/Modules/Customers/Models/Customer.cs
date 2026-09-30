namespace backend.Modules.Customers.Models;

public class Customer
{
    public int Id { get; set; }
    public required string CustomerCode { get; set; } // e.g. CUST-001
    public required string Name { get; set; }
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string CustomerType { get; set; } = "Registered"; // Walk-in, Registered, Business
    public decimal CreditLimit { get; set; }
    public string PaymentTerms { get; set; } = "Cash"; // Cash, Net 15, Net 30
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAtUtc { get; set; }
}

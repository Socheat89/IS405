namespace backend.Modules.Audit.Models;

public class AuditLog
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string? Username { get; set; }
    public required string Action { get; set; } // CREATE, UPDATE, DELETE, APPROVE, CANCEL, etc.
    public required string EntityName { get; set; }
    public string? EntityId { get; set; }
    public required string Description { get; set; }
    public string? DetailsJson { get; set; }
    public string? IpAddress { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

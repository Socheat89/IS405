namespace backend.Models.Data;

public class AppPermission
{
    public int Id { get; set; }
    public int PageId { get; set; }
    public AppPage Page { get; set; } = null!;
    public required string Code { get; set; }
    public required string Action { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public int? CreatedBy { get; set; }
    public DateTimeOffset? UpdatedAtUtc { get; set; }
    public int? UpdatedBy { get; set; }
    public ICollection<AppRolePermission> RolePermissions { get; set; } = [];
    public ICollection<AppUserPermission> UserPermissions { get; set; } = [];
}


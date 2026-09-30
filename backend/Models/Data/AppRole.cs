namespace backend.Models.Data;

public class AppRole
{
    public int Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public int CreatedBy { get; set; }
    public DateTimeOffset? UpdatedAtUtc { get; set; }
    public int? UpdatedBy { get; set; }
    public ICollection<AppRolePermission> RolePermissions { get; set; } = [];
    public ICollection<AppUserRole> UserRoles { get; set; } = [];
}

namespace backend.Models.Data;

public class AppRolePermission
{
    public int RoleId { get; set; }
    public AppRole Role { get; set; } = null!;
    public int PermissionId { get; set; }
    public AppPermission Permission { get; set; } = null!;
    public DateTimeOffset AssignedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public int? AssignedBy { get; set; }
}

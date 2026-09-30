namespace backend.Models.Data;

public class AppUserPermission
{
    public int UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public int PermissionId { get; set; }
    public AppPermission Permission { get; set; } = null!;
    public DateTimeOffset AssignedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public int? AssignedBy { get; set; }
}

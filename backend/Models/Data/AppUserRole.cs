namespace backend.Models.Data;

public class AppUserRole
{
    public int UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public int RoleId { get; set; }
    public AppRole Role { get; set; } = null!;
    public DateTimeOffset AssignedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public int AssignedBy { get; set; }
}

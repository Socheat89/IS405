namespace backend.Models.Data;

public class AppUser
{
    public int Id { get; set; }
    public required string Username { get; set; }
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public bool TwoFactorEnabled { get; set; }
    public string? TwoFactorSecret { get; set; }
    public int FailedLoginCount { get; set; }
    public DateTimeOffset? LockoutEndUtc { get; set; }
    public bool IsActive { get; set; } = true;
    public string? InvitationToken { get; set; }
    public DateTimeOffset? InvitationExpiresAtUtc { get; set; }
    public bool MustSetPassword { get; set; } = false;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAtUtc { get; set; }
    public ICollection<AppUserRole> UserRoles { get; set; } = [];
    public ICollection<AppUserPermission> UserPermissions { get; set; } = [];
    public ICollection<AppUserWarehouse> UserWarehouses { get; set; } = [];
}


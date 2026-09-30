namespace backend.Models.Request;

public record UserDto(
    int Id,
    string Username,
    string Email,
    IReadOnlyList<string> Roles,
    IReadOnlyList<int> RoleIds,
    IReadOnlyList<int> DirectPermissionIds,
    IReadOnlyList<string> EffectivePermissions,
    bool IsActive,
    bool TwoFactorEnabled,
    DateTimeOffset CreatedAtUtc,
    bool MustSetPassword = false,
    string? InvitationLink = null,
    IReadOnlyList<int>? WarehouseIds = null,
    IReadOnlyList<string>? WarehouseNames = null,
    int? DefaultWarehouseId = null);

public class CreateUserWithRolesRequest
{
    public required string Username { get; set; }
    public required string Email { get; set; }
    public string? Password { get; set; }
    public bool SendInvitationEmail { get; set; } = true;
    public List<int> RoleIds { get; set; } = [];
    public List<int> DirectPermissionIds { get; set; } = [];
    public List<int> WarehouseIds { get; set; } = [];
    public int? DefaultWarehouseId { get; set; }
}

public class UpdateUserRolesRequest
{
    public List<int> RoleIds { get; set; } = [];
    public List<int> DirectPermissionIds { get; set; } = [];
    public List<int> WarehouseIds { get; set; } = [];
    public int? DefaultWarehouseId { get; set; }
}

public class UpdateUserStatusRequest
{
    public bool IsActive { get; set; }
}

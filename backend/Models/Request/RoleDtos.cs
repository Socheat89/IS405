namespace backend.Models.Request;

public sealed class RoleQueryRequest
{
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? Status { get; set; }
    public string? Search { get; set; }
}

public class CreateRoleRequest
{
    public required string Code { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public List<int> PermissionIds { get; set; } = [];
}

public class UpdateRoleRequest
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public List<int>? PermissionIds { get; set; }
}

public class UpdateRolePermissionsRequest
{
    public List<int> PermissionIds { get; set; } = [];
}

public record RoleResponse(
    int Id,
    string Code,
    string Name,
    string? Description,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? UpdatedAtUtc,
    IReadOnlyList<int>? PermissionIds = null);

public sealed record RolePageResponse(
    IReadOnlyList<RoleResponse> Items,
    int PageNumber,
    int PageSize,
    int TotalCount,
    int TotalPages,
    int TotalRoles,
    int ActiveRoles);

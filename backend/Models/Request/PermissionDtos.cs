namespace backend.Models.Request;

public class CreatePermissionRequest
{
    public int PageId { get; set; }
    public required string Action { get; set; }
    public string? Description { get; set; }
}

public class UpdatePermissionRequest
{
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public record PermissionResponse(
    int Id,
    int PageId,
    string PageCode,
    string PageName,
    string Code,
    string Action,
    string? Description,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? UpdatedAtUtc);

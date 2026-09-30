namespace backend.Models.Data;

public class AppPage
{
    public int Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public string? Route { get; set; }
    public string? Icon { get; set; }
    public int? ParentId { get; set; }
    public AppPage? Parent { get; set; }
    public ICollection<AppPage> Children { get; set; } = [];
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public int CreatedBy { get; set; }
    public DateTimeOffset? UpdatedAtUtc { get; set; }
    public int? UpdatedBy { get; set; }
    public ICollection<AppPermission> Permissions { get; set; } = [];
}

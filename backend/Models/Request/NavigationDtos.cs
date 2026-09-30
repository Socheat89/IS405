namespace backend.Models.Request;

public record NavigationItemResponse(
    int Id,
    string Code,
    string Label,
    string? Route,
    string? Icon,
    int SortOrder,
    IReadOnlyList<NavigationItemResponse> Children);

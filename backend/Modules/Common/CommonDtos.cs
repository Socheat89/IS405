namespace backend.Modules.Common;

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int PageNumber,
    int PageSize
)
{
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / (PageSize > 0 ? PageSize : 1));
    public bool HasPreviousPage => PageNumber > 1;
    public bool HasNextPage => PageNumber < TotalPages;
}

public record ApiResponse<T>(
    bool Success,
    string? Message,
    T? Data
)
{
    public static ApiResponse<T> Ok(T data, string? message = null) => new(true, message, data);
    public static ApiResponse<T> Fail(string message) => new(false, message, default);
}

namespace backend.Services.Common;

public class ServiceResult<T>
{
    public bool Succeeded { get; protected set; }
    public T? Value { get; protected set; }
    public string? Message { get; protected set; }
    public int StatusCode { get; protected set; } = 200;
}

public class UserServiceResult<T> : ServiceResult<T>
{
    public DateTimeOffset? LockoutEndUtc { get; private set; }

    public static UserServiceResult<T> Success(T value, int statusCode = 200) =>
        new() { Succeeded = true, Value = value, StatusCode = statusCode };

    public static UserServiceResult<T> BadRequest(string message) =>
        new() { Succeeded = false, Message = message, StatusCode = 400 };

    public static UserServiceResult<T> Unauthorized(string message) =>
        new() { Succeeded = false, Message = message, StatusCode = 401 };

    public static UserServiceResult<T> Locked(string message, DateTimeOffset lockoutEndUtc) =>
        new() { Succeeded = false, Message = message, StatusCode = 423, LockoutEndUtc = lockoutEndUtc };

    public static UserServiceResult<T> Conflict(string message) =>
        new() { Succeeded = false, Message = message, StatusCode = 409 };

    public static UserServiceResult<T> NotFound(string message) =>
        new() { Succeeded = false, Message = message, StatusCode = 404 };
}

public class PermissionServiceResult<T> : ServiceResult<T>
{
    public static PermissionServiceResult<T> Success(T value, int statusCode = 200) =>
        new() { Succeeded = true, Value = value, StatusCode = statusCode };

    public static PermissionServiceResult<T> BadRequest(string message) =>
        new() { Succeeded = false, Message = message, StatusCode = 400 };

    public static PermissionServiceResult<T> NotFound(string message) =>
        new() { Succeeded = false, Message = message, StatusCode = 404 };

    public static PermissionServiceResult<T> Conflict(string message) =>
        new() { Succeeded = false, Message = message, StatusCode = 409 };
}

public class RoleServiceResult<T> : ServiceResult<T>
{
    public static RoleServiceResult<T> Success(T value, int statusCode = 200) =>
        new() { Succeeded = true, Value = value, StatusCode = statusCode };

    public static RoleServiceResult<T> BadRequest(string message) =>
        new() { Succeeded = false, Message = message, StatusCode = 400 };

    public static RoleServiceResult<T> NotFound(string message) =>
        new() { Succeeded = false, Message = message, StatusCode = 404 };

    public static RoleServiceResult<T> Conflict(string message) =>
        new() { Succeeded = false, Message = message, StatusCode = 409 };
}

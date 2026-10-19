namespace backend.Services.QrAuth;

public class TrustedDeviceRecord
{
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceSecret { get; set; } = string.Empty;
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? DeviceName { get; set; }
    public string? LastIpAddress { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset LastUsedAtUtc { get; set; }
    public bool IsRevoked { get; set; }
}

public interface ITrustedDeviceService
{
    Task<TrustedDeviceRecord?> ValidateDeviceAsync(string deviceId, string deviceSecret, string? ipAddress);
    Task<TrustedDeviceRecord> RegisterDeviceAsync(int userId, string username, string email, string? deviceName, string? ipAddress);
    Task<bool> RevokeDeviceAsync(string deviceId, string? deviceSecret);
    Task<bool> RevokeAllUserDevicesAsync(int userId);
    Task<List<TrustedDeviceRecord>> GetUserDevicesAsync(int userId);
    Task<bool> IsSystemQrLoginEnabledAsync();
    Task SetSystemQrLoginEnabledAsync(bool enabled);
    Task<bool> IsUserQrLoginEnabledAsync(int userId);
    Task SetUserQrLoginEnabledAsync(int userId, bool enabled);
}

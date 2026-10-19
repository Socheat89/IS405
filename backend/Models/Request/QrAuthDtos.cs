namespace backend.Models.Request;

public class QrGenerateRequest
{
    public string? ClientBaseUrl { get; set; }
}

public class QrGenerateResponse
{
    public string QrToken { get; set; } = string.Empty;
    public string ApprovalUrl { get; set; } = string.Empty;
    public string? QrCodeDataUrl { get; set; }
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public int ExpiresInSeconds { get; set; }
}

public class QrStatusResponse
{
    public string Status { get; set; } = "Pending"; // "Pending", "Scanned", "Approved", "Rejected", "Expired"
    public string? AccessToken { get; set; }
    public UserResponse? User { get; set; }
    public string? Message { get; set; }
    public DateTimeOffset? ExpiresAtUtc { get; set; }
}

public class QrApproveRequest
{
    public string QrToken { get; set; } = string.Empty;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? TwoFactorCode { get; set; }

    // Trusted Device pairing fields
    public string? DeviceId { get; set; }
    public string? DeviceSecret { get; set; }
    public bool TrustThisDevice { get; set; } = true;
    public string? DeviceName { get; set; }
}

public class QrRejectRequest
{
    public string QrToken { get; set; } = string.Empty;
    public string? Reason { get; set; }
}

public class QrSessionInfoResponse
{
    public string QrToken { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public string? DeviceIp { get; set; }
    public string? UserAgent { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public bool IsExpired { get; set; }
}

public class CheckDeviceRequest
{
    public string QrToken { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceSecret { get; set; } = string.Empty;
}

public class CheckDeviceResponse
{
    public bool IsTrusted { get; set; }
    public UserResponse? User { get; set; }
    public string? DeviceName { get; set; }
    public string? Message { get; set; }
}

public class TrustedDeviceDto
{
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceSecret { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? DeviceName { get; set; }
}

public class QrApproveResponse
{
    public bool Success { get; set; }
    public bool RequiresTwoFactor { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Username { get; set; }
    public List<string>? Roles { get; set; }
    public TrustedDeviceDto? TrustedDevice { get; set; }
}

public class RevokeDeviceRequest
{
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceSecret { get; set; } = string.Empty;
}

public class TrustedDeviceSummaryDto
{
    public string DeviceId { get; set; } = string.Empty;
    public string? DeviceName { get; set; }
    public string? LastIpAddress { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset LastUsedAtUtc { get; set; }
}

public class QrSettingsResponse
{
    public bool SystemQrEnabled { get; set; } = true;
    public bool UserQrEnabled { get; set; } = true;
    public List<TrustedDeviceSummaryDto> Devices { get; set; } = [];
}

public class ToggleQrRequest
{
    public bool Enabled { get; set; }
}

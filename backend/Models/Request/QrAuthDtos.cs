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

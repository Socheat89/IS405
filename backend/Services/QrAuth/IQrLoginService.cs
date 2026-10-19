using backend.Models.Data;
using backend.Models.Request;

namespace backend.Services.QrAuth;

public class QrLoginSession
{
    public string QrToken { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending"; // "Pending", "Scanned", "Approved", "Rejected", "Expired"
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public string? DeviceIp { get; set; }
    public string? UserAgent { get; set; }
    public string? ApprovalUrl { get; set; }
    public string? QrCodeDataUrl { get; set; }

    // Approval data
    public int? ApprovedUserId { get; set; }
    public string? ApprovedUsername { get; set; }
    public string? ApprovedEmail { get; set; }
    public bool ApprovedTwoFactorEnabled { get; set; }
    public string? AccessToken { get; set; }
    public DateTimeOffset? AccessTokenExpiresAt { get; set; }
    public string? RejectReason { get; set; }
}

public interface IQrLoginService
{
    QrLoginSession CreateSession(string? clientIp, string? userAgent, string baseUrl);
    QrLoginSession? GetSession(string qrToken);
    bool MarkScanned(string qrToken, string? scannerIp);
    bool ApproveSession(string qrToken, AppUser user, string accessToken, DateTimeOffset expiresAt);
    bool RejectSession(string qrToken, string? reason);
}

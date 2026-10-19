using System.Collections.Concurrent;
using System.Security.Cryptography;
using backend.Models.Data;
using backend.Models.Request;
using QRCoder;

namespace backend.Services.QrAuth;

public class QrLoginService : IQrLoginService
{
    private readonly ConcurrentDictionary<string, QrLoginSession> _sessions = new();
    private static readonly TimeSpan SessionTtl = TimeSpan.FromMinutes(3);

    public QrLoginSession CreateSession(string? clientIp, string? userAgent, string baseUrl)
    {
        CleanupExpiredSessions();

        // Generate 32-character url-safe cryptographic token
        var randomBytes = new byte[24];
        RandomNumberGenerator.Fill(randomBytes);
        var token = Convert.ToBase64String(randomBytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');

        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.Add(SessionTtl);

        var trimmedBaseUrl = baseUrl.TrimEnd('/');
        var approvalUrl = $"{trimmedBaseUrl}/#qr-approve?token={token}";

        // Generate QR Code image base64
        string? qrCodeDataUrl = null;
        try
        {
            using var qrGenerator = new QRCodeGenerator();
            using var qrCodeData = qrGenerator.CreateQrCode(approvalUrl, QRCodeGenerator.ECCLevel.M);
            var pngByteQrCode = new PngByteQRCode(qrCodeData);
            var qrCodeBytes = pngByteQrCode.GetGraphic(15);
            qrCodeDataUrl = $"data:image/png;base64,{Convert.ToBase64String(qrCodeBytes)}";
        }
        catch
        {
            // Fallback: client will render via qrcode.react
        }

        var session = new QrLoginSession
        {
            QrToken = token,
            Status = "Pending",
            CreatedAtUtc = now,
            ExpiresAtUtc = expiresAt,
            DeviceIp = clientIp,
            UserAgent = userAgent,
            ApprovalUrl = approvalUrl,
            QrCodeDataUrl = qrCodeDataUrl
        };

        _sessions[token] = session;
        return session;
    }

    public QrLoginSession? GetSession(string qrToken)
    {
        if (string.IsNullOrWhiteSpace(qrToken)) return null;

        if (_sessions.TryGetValue(qrToken, out var session))
        {
            if (DateTimeOffset.UtcNow > session.ExpiresAtUtc && session.Status != "Approved")
            {
                session.Status = "Expired";
            }
            return session;
        }

        return null;
    }

    public bool MarkScanned(string qrToken, string? scannerIp)
    {
        var session = GetSession(qrToken);
        if (session == null || session.Status == "Expired" || session.Status == "Approved" || session.Status == "Rejected")
        {
            return false;
        }

        if (session.Status == "Pending")
        {
            session.Status = "Scanned";
            return true;
        }

        return true;
    }

    public bool ApproveSession(string qrToken, AppUser user, string accessToken, DateTimeOffset expiresAt)
    {
        var session = GetSession(qrToken);
        if (session == null || session.Status == "Expired" || session.Status == "Rejected")
        {
            return false;
        }

        session.Status = "Approved";
        session.ApprovedUserId = user.Id;
        session.ApprovedUsername = user.Username;
        session.ApprovedEmail = user.Email;
        session.AccessToken = accessToken;
        session.AccessTokenExpiresAt = expiresAt;

        return true;
    }

    public bool RejectSession(string qrToken, string? reason)
    {
        var session = GetSession(qrToken);
        if (session == null || session.Status == "Approved")
        {
            return false;
        }

        session.Status = "Rejected";
        session.RejectReason = reason ?? "Rejected by user";
        return true;
    }

    private void CleanupExpiredSessions()
    {
        var now = DateTimeOffset.UtcNow;
        var expiredThreshold = now.AddMinutes(-5);

        foreach (var kvp in _sessions)
        {
            if (kvp.Value.ExpiresAtUtc < expiredThreshold)
            {
                _sessions.TryRemove(kvp.Key, out _);
            }
        }
    }
}

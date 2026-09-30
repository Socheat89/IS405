using backend.Data;
using backend.Models.Request;
using backend.Services.Common;
using Microsoft.EntityFrameworkCore;
using OtpNet;
using QRCoder;

namespace backend.Services.TwoFactor;

public class TwoFactorService : ITwoFactorService
{
    private const int MaxFailedAttempts = 5;
    private const int LockoutDurationMinutes = 30;
    private const string DefaultIssuer = "Mekong Stock";

    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ITokenService _tokenService;

    public TwoFactorService(
        AppDbContext context,
        IConfiguration configuration,
        ITokenService tokenService)
    {
        _context = context;
        _configuration = configuration;
        _tokenService = tokenService;
    }

    public async Task<UserServiceResult<TwoFactorSetupResponse>> SetupTwoFactorAsync(
        int userId,
        string? ipAddress,
        CancellationToken cancellationToken)
    {
        var user = await _context.Users.FindAsync([userId], cancellationToken);
        if (user == null || !user.IsActive)
        {
            return UserServiceResult<TwoFactorSetupResponse>.Unauthorized("Missing or invalid access token");
        }

        // Generate TOTP Secret (20 bytes Base32)
        var secretBytes = KeyGeneration.GenerateRandomKey(20);
        var secret = Base32Encoding.ToString(secretBytes);

        user.TwoFactorSecret = secret;
        user.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        var issuer = _configuration["TwoFactor:Issuer"] ?? DefaultIssuer;
        var otpAuthUri = $"otpauth://totp/{Uri.EscapeDataString(issuer)}:{Uri.EscapeDataString(user.Email)}?secret={secret}&issuer={Uri.EscapeDataString(issuer)}&digits=6";

        using var qrGenerator = new QRCodeGenerator();
        using var qrCodeData = qrGenerator.CreateQrCode(otpAuthUri, QRCodeGenerator.ECCLevel.Q);
        var pngByteQrCode = new PngByteQRCode(qrCodeData);
        var qrCodeBytes = pngByteQrCode.GetGraphic(20);
        var qrCodeDataUrl = $"data:image/png;base64,{Convert.ToBase64String(qrCodeBytes)}";

        return UserServiceResult<TwoFactorSetupResponse>.Success(
            new TwoFactorSetupResponse(secret, otpAuthUri, qrCodeDataUrl));
    }

    public async Task<UserServiceResult<MessageResponse>> EnableTwoFactorAsync(
        int userId,
        EnableTwoFactorRequest request,
        string? ipAddress,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.TwoFactorCode) ||
            request.TwoFactorCode.Length != 6 ||
            !request.TwoFactorCode.All(char.IsDigit))
        {
            return UserServiceResult<MessageResponse>.BadRequest("Invalid two-factor code or setup is required");
        }

        var user = await _context.Users.FindAsync([userId], cancellationToken);
        if (user == null || !user.IsActive)
        {
            return UserServiceResult<MessageResponse>.Unauthorized("Missing or invalid access token");
        }

        if (user.TwoFactorEnabled)
        {
            return UserServiceResult<MessageResponse>.Conflict("Two-factor authentication is already enabled");
        }

        if (string.IsNullOrEmpty(user.TwoFactorSecret))
        {
            return UserServiceResult<MessageResponse>.BadRequest("Invalid two-factor code or setup is required");
        }

        try
        {
            var secretBytes = Base32Encoding.ToBytes(user.TwoFactorSecret);
            var totp = new Totp(secretBytes);
            var isValid = totp.VerifyTotp(request.TwoFactorCode, out _, VerificationWindow.RfcSpecifiedNetworkDelay);

            if (!isValid)
            {
                return UserServiceResult<MessageResponse>.BadRequest("Invalid two-factor code or setup is required");
            }
        }
        catch
        {
            return UserServiceResult<MessageResponse>.BadRequest("Invalid two-factor code or setup is required");
        }

        user.TwoFactorEnabled = true;
        user.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return UserServiceResult<MessageResponse>.Success(
            new MessageResponse("Two-factor authentication enabled."));
    }

    public async Task<UserServiceResult<LoginResponse>> VerifyTwoFactorLoginAsync(
        VerifyTwoFactorRequest request,
        string? ipAddress,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ChallengeToken) ||
            string.IsNullOrWhiteSpace(request.TwoFactorCode) ||
            request.TwoFactorCode.Length != 6 ||
            !request.TwoFactorCode.All(char.IsDigit))
        {
            return UserServiceResult<LoginResponse>.Unauthorized("Invalid challenge token or two-factor code");
        }

        var userId = _tokenService.ValidateChallengeToken(request.ChallengeToken);
        if (userId == null)
        {
            return UserServiceResult<LoginResponse>.Unauthorized("Invalid challenge token or two-factor code");
        }

        var user = await _context.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId.Value, cancellationToken);

        if (user == null || !user.IsActive || string.IsNullOrEmpty(user.TwoFactorSecret))
        {
            return UserServiceResult<LoginResponse>.Unauthorized("Invalid challenge token or two-factor code");
        }

        // Check if account is locked
        if (user.LockoutEndUtc.HasValue)
        {
            if (user.LockoutEndUtc.Value > DateTimeOffset.UtcNow)
            {
                var remainingMinutes = Math.Ceiling((user.LockoutEndUtc.Value - DateTimeOffset.UtcNow).TotalMinutes);
                return UserServiceResult<LoginResponse>.Locked(
                    $"Account is locked. Please try again in {remainingMinutes} minute(s).",
                    user.LockoutEndUtc.Value);
            }

            // Lockout expired
            user.LockoutEndUtc = null;
            user.FailedLoginCount = 0;
        }

        try
        {
            var secretBytes = Base32Encoding.ToBytes(user.TwoFactorSecret);
            var totp = new Totp(secretBytes);
            var isValid = totp.VerifyTotp(request.TwoFactorCode, out _, VerificationWindow.RfcSpecifiedNetworkDelay);

            if (!isValid)
            {
                user.FailedLoginCount++;
                if (user.FailedLoginCount >= MaxFailedAttempts)
                {
                    user.LockoutEndUtc = DateTimeOffset.UtcNow.AddMinutes(LockoutDurationMinutes);
                    await _context.SaveChangesAsync(cancellationToken);
                    return UserServiceResult<LoginResponse>.Locked(
                        $"Account is locked for {LockoutDurationMinutes} minutes due to {MaxFailedAttempts} failed login attempts.",
                        user.LockoutEndUtc.Value);
                }

                await _context.SaveChangesAsync(cancellationToken);
                return UserServiceResult<LoginResponse>.Unauthorized("Invalid challenge token or two-factor code");
            }
        }
        catch
        {
            return UserServiceResult<LoginResponse>.Unauthorized("Invalid challenge token or two-factor code");
        }

        // Success - reset lockout, mark 2FA enabled, and reset failed attempts
        user.TwoFactorEnabled = true;
        user.FailedLoginCount = 0;
        user.LockoutEndUtc = null;
        await _context.SaveChangesAsync(cancellationToken);

        var roles = user.UserRoles.Select(ur => ur.Role.Code).ToList();
        var (accessToken, expiresAt) = _tokenService.GenerateAccessToken(user, roles);

        return UserServiceResult<LoginResponse>.Success(
            new LoginResponse(
                RequiresTwoFactor: false,
                AccessToken: accessToken,
                ChallengeToken: null,
                ExpiresAtUtc: expiresAt));
    }

    public async Task<UserServiceResult<MessageResponse>> DisableTwoFactorAsync(
        int userId,
        EnableTwoFactorRequest request,
        string? ipAddress,
        CancellationToken cancellationToken)
    {
        var user = await _context.Users.FindAsync([userId], cancellationToken);
        if (user == null || !user.IsActive)
        {
            return UserServiceResult<MessageResponse>.Unauthorized("Missing or invalid access token");
        }

        if (!user.TwoFactorEnabled || string.IsNullOrEmpty(user.TwoFactorSecret))
        {
            return UserServiceResult<MessageResponse>.BadRequest("Two-factor authentication is not enabled");
        }

        if (string.IsNullOrWhiteSpace(request.TwoFactorCode) ||
            request.TwoFactorCode.Length != 6 ||
            !request.TwoFactorCode.All(char.IsDigit))
        {
            return UserServiceResult<MessageResponse>.BadRequest("Invalid two-factor code");
        }

        try
        {
            var secretBytes = Base32Encoding.ToBytes(user.TwoFactorSecret);
            var totp = new Totp(secretBytes);
            var isValid = totp.VerifyTotp(request.TwoFactorCode, out _, VerificationWindow.RfcSpecifiedNetworkDelay);

            if (!isValid)
            {
                return UserServiceResult<MessageResponse>.BadRequest("Invalid two-factor code");
            }
        }
        catch
        {
            return UserServiceResult<MessageResponse>.BadRequest("Invalid two-factor code");
        }

        user.TwoFactorEnabled = false;
        user.TwoFactorSecret = null;
        user.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return UserServiceResult<MessageResponse>.Success(
            new MessageResponse("Two-factor authentication disabled."));
    }
}

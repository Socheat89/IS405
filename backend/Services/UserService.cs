using System.Net.Mail;
using System.Security.Cryptography;
using backend.Data;
using backend.Models.Data;
using backend.Models.Request;
using backend.Services.Common;
using backend.Services.Email;
using backend.Services.Security;
using backend.Services.TwoFactor;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OtpNet;
using QRCoder;

namespace backend.Services;

public class UserService : IUserService
{
    private const int MaxFailedAttempts = 5;
    private const int LockoutDurationMinutes = 5;

    private readonly AppDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly ITwoFactorService _twoFactorService;
    private readonly IIpLockoutService _ipLockoutService;
    private readonly IEmailService _emailService;
    private readonly IConfiguration _configuration;
    private readonly PasswordHasher<AppUser> _passwordHasher;

    public UserService(
        AppDbContext context,
        ITokenService tokenService,
        ITwoFactorService twoFactorService,
        IIpLockoutService ipLockoutService,
        IEmailService emailService,
        IConfiguration configuration)
    {
        _context = context;
        _tokenService = tokenService;
        _twoFactorService = twoFactorService;
        _ipLockoutService = ipLockoutService;
        _emailService = emailService;
        _configuration = configuration;
        _passwordHasher = new PasswordHasher<AppUser>();
    }

    public async Task<UserServiceResult<UserResponse>> RegisterAsync(
        RegisterRequest request,
        string? ipAddress,
        CancellationToken cancellationToken)
    {
        // 1. Validation
        if (string.IsNullOrWhiteSpace(request.Username) || request.Username.Length < 3 || request.Username.Length > 100)
        {
            return UserServiceResult<UserResponse>.BadRequest("Username must be between 3 and 100 characters.");
        }

        if (string.IsNullOrWhiteSpace(request.Email) || !IsValidEmail(request.Email))
        {
            return UserServiceResult<UserResponse>.BadRequest("A valid email address is required.");
        }

        var (isValidPassword, passwordError) = PasswordPolicy.Validate(request.Password);
        if (!isValidPassword)
        {
            return UserServiceResult<UserResponse>.BadRequest(passwordError ?? "A strong password is required.");
        }

        // 2. Conflict checks
        var usernameTrimmed = request.Username.Trim();
        var emailTrimmed = request.Email.Trim().ToLowerInvariant();

        var usernameExists = await _context.Users
            .Where(u => u.Username.ToLower() == usernameTrimmed.ToLower())
            .Select(u => u.Id)
            .FirstOrDefaultAsync(cancellationToken) > 0;

        if (usernameExists)
        {
            return UserServiceResult<UserResponse>.Conflict("Username or email already exists");
        }

        var emailExists = await _context.Users
            .Where(u => u.Email.ToLower() == emailTrimmed)
            .Select(u => u.Id)
            .FirstOrDefaultAsync(cancellationToken) > 0;

        if (emailExists)
        {
            return UserServiceResult<UserResponse>.Conflict("Username or email already exists");
        }

        // 3. Create user
        var user = new AppUser
        {
            Username = usernameTrimmed,
            Email = emailTrimmed,
            PasswordHash = string.Empty,
            TwoFactorEnabled = false,
            IsActive = true,
            MustSetPassword = false,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        // Assign default Staff/Support role if exists
        var defaultRole = await _context.Roles.FirstOrDefaultAsync(
            r => r.IsActive && (r.Code == "STAFF" || r.Code == "Staff" || r.Code == "SUPPORT"),
            cancellationToken);
        if (defaultRole != null)
        {
            _context.UserRoles.Add(new AppUserRole
            {
                UserId = user.Id,
                RoleId = defaultRole.Id,
                AssignedAtUtc = DateTimeOffset.UtcNow,
                AssignedBy = user.Id
            });
            await _context.SaveChangesAsync(cancellationToken);
        }

        return UserServiceResult<UserResponse>.Success(
            new UserResponse(user.Id, user.Username, user.Email),
            statusCode: 201);
    }

    public async Task<UserServiceResult<LoginResponse>> LoginAsync(
        LoginRequest request,
        string? ipAddress,
        CancellationToken cancellationToken)
    {
        // 1. IP Lockout Check: Block IP for 5 minutes after 5 failed attempts
        if (_ipLockoutService.IsIpBlocked(ipAddress, out var ipRemaining, out var ipLockoutEnd))
        {
            var remainingSec = Math.Max(1, (int)Math.Ceiling(ipRemaining.TotalSeconds));
            var remainingMin = (int)Math.Ceiling(ipRemaining.TotalMinutes);
            return UserServiceResult<LoginResponse>.Locked(
                $"This IP address has been temporarily blocked for 5 minutes due to 5 consecutive failed login attempts. Please try again in {remainingMin} minute(s) ({remainingSec}s).",
                ipLockoutEnd ?? DateTimeOffset.UtcNow.AddMinutes(LockoutDurationMinutes));
        }

        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            _ipLockoutService.RecordFailedAttempt(ipAddress);
            return UserServiceResult<LoginResponse>.Unauthorized("Invalid username or password");
        }

        var usernameTrimmed = request.Username.Trim().ToLowerInvariant();

        var user = await _context.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Username.ToLower() == usernameTrimmed || u.Email.ToLower() == usernameTrimmed, cancellationToken);

        if (user == null || !user.IsActive)
        {
            var ipStatus = _ipLockoutService.RecordFailedAttempt(ipAddress);
            if (ipStatus.IsBlocked)
            {
                return UserServiceResult<LoginResponse>.Locked(
                    "This IP address has been blocked for 5 minutes due to 5 consecutive failed login attempts.",
                    ipStatus.LockoutEndUtc ?? DateTimeOffset.UtcNow.AddMinutes(LockoutDurationMinutes));
            }

            return UserServiceResult<LoginResponse>.Unauthorized("Invalid username or password");
        }

        // Account-level lockout check
        if (user.LockoutEndUtc.HasValue)
        {
            if (user.LockoutEndUtc.Value > DateTimeOffset.UtcNow)
            {
                return UserServiceResult<LoginResponse>.Locked(
                    "Account is temporarily locked due to multiple failed login attempts.",
                    user.LockoutEndUtc.Value);
            }

            // Lockout expired
            user.LockoutEndUtc = null;
            user.FailedLoginCount = 0;
        }

        // Check if user has not set their password yet (invitation flow)
        if (user.MustSetPassword)
        {
            return UserServiceResult<LoginResponse>.Unauthorized(
                "Your account is pending password setup. Please check your email and click the invitation link to set your password.");
        }

        // Verify password
        var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verifyResult == PasswordVerificationResult.Failed)
        {
            var ipStatus = _ipLockoutService.RecordFailedAttempt(ipAddress);
            user.FailedLoginCount++;

            if (user.FailedLoginCount >= MaxFailedAttempts || ipStatus.IsBlocked)
            {
                user.LockoutEndUtc = DateTimeOffset.UtcNow.AddMinutes(LockoutDurationMinutes);
                await _context.SaveChangesAsync(cancellationToken);
                return UserServiceResult<LoginResponse>.Locked(
                    $"Too many failed attempts. Access is locked for {LockoutDurationMinutes} minutes.",
                    user.LockoutEndUtc.Value);
            }

            await _context.SaveChangesAsync(cancellationToken);
            return UserServiceResult<LoginResponse>.Unauthorized("Invalid username or password");
        }

        // Password succeeded - reset failed count & IP failed count
        user.FailedLoginCount = 0;
        user.LockoutEndUtc = null;
        await _context.SaveChangesAsync(cancellationToken);
        _ipLockoutService.ResetFailedAttempts(ipAddress);

        // MANDATORY 2FA FOR ALL USERS: Every user must complete 2FA before entering the system.
        var (challengeToken, challengeExpiresAt) = _tokenService.GenerateChallengeToken(user);

        // Case 1: User has already setup and enabled 2FA -> Prompt for 6-digit TOTP code
        if (user.TwoFactorEnabled && !string.IsNullOrEmpty(user.TwoFactorSecret))
        {
            return UserServiceResult<LoginResponse>.Success(
                new LoginResponse(
                    RequiresTwoFactor: true,
                    AccessToken: null,
                    ChallengeToken: challengeToken,
                    ExpiresAtUtc: challengeExpiresAt,
                    RequiresSetup: false));
        }

        // Case 2: First-time login or 2FA not yet enabled -> Force user to Setup 2FA
        if (string.IsNullOrEmpty(user.TwoFactorSecret))
        {
            var secretBytes = KeyGeneration.GenerateRandomKey(20);
            user.TwoFactorSecret = Base32Encoding.ToString(secretBytes);
            user.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
        }

        var issuer = _configuration["TwoFactor:Issuer"] ?? "Mekong Stock";
        var otpAuthUri = $"otpauth://totp/{Uri.EscapeDataString(issuer)}:{Uri.EscapeDataString(user.Email)}?secret={user.TwoFactorSecret}&issuer={Uri.EscapeDataString(issuer)}&digits=6";

        using var qrGenerator = new QRCodeGenerator();
        using var qrCodeData = qrGenerator.CreateQrCode(otpAuthUri, QRCodeGenerator.ECCLevel.Q);
        var pngByteQrCode = new PngByteQRCode(qrCodeData);
        var qrCodeBytes = pngByteQrCode.GetGraphic(20);
        var qrCodeDataUrl = $"data:image/png;base64,{Convert.ToBase64String(qrCodeBytes)}";

        return UserServiceResult<LoginResponse>.Success(
            new LoginResponse(
                RequiresTwoFactor: true,
                AccessToken: null,
                ChallengeToken: challengeToken,
                ExpiresAtUtc: challengeExpiresAt,
                RequiresSetup: true,
                QrCodeDataUrl: qrCodeDataUrl,
                Secret: user.TwoFactorSecret));
    }

    public async Task<UserServiceResult<ValidateInvitationResponse>> ValidateInvitationAsync(
        string token,
        string email,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(email))
        {
            return UserServiceResult<ValidateInvitationResponse>.BadRequest("Invitation token and email are required.");
        }

        var cleanEmail = email.Trim().ToLowerInvariant();
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == cleanEmail && u.InvitationToken == token, cancellationToken);

        if (user == null)
        {
            return UserServiceResult<ValidateInvitationResponse>.Success(
                new ValidateInvitationResponse(false, null, null, "Invalid invitation link or account does not exist."));
        }

        if (user.InvitationExpiresAtUtc.HasValue && user.InvitationExpiresAtUtc.Value < DateTimeOffset.UtcNow)
        {
            return UserServiceResult<ValidateInvitationResponse>.Success(
                new ValidateInvitationResponse(false, user.Username, user.Email, "This invitation link has expired. Please contact an administrator for a new invite."));
        }

        return UserServiceResult<ValidateInvitationResponse>.Success(
            new ValidateInvitationResponse(true, user.Username, user.Email, "Invitation is valid."));
    }

    public async Task<UserServiceResult<MessageResponse>> SetPasswordAsync(
        SetPasswordRequest request,
        string? ipAddress,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token) || string.IsNullOrWhiteSpace(request.Email))
        {
            return UserServiceResult<MessageResponse>.BadRequest("Invitation token and email are required.");
        }

        if (string.IsNullOrWhiteSpace(request.Password))
        {
            return UserServiceResult<MessageResponse>.BadRequest("Password is required.");
        }

        if (request.Password != request.ConfirmPassword)
        {
            return UserServiceResult<MessageResponse>.BadRequest("Password and Confirm Password do not match.");
        }

        var (isValidPassword, passwordError) = PasswordPolicy.Validate(request.Password);
        if (!isValidPassword)
        {
            return UserServiceResult<MessageResponse>.BadRequest(passwordError ?? "A strong password is required.");
        }

        var cleanEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == cleanEmail && u.InvitationToken == request.Token, cancellationToken);

        if (user == null)
        {
            return UserServiceResult<MessageResponse>.BadRequest("Invalid or expired invitation token.");
        }

        if (user.InvitationExpiresAtUtc.HasValue && user.InvitationExpiresAtUtc.Value < DateTimeOffset.UtcNow)
        {
            return UserServiceResult<MessageResponse>.BadRequest("This invitation link has expired. Please request a new invitation from your administrator.");
        }

        // Set the user's password and activate account
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        user.InvitationToken = null;
        user.InvitationExpiresAtUtc = null;
        user.MustSetPassword = false;
        user.IsActive = true;
        user.FailedLoginCount = 0;
        user.LockoutEndUtc = null;
        user.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        _ipLockoutService.ResetFailedAttempts(ipAddress);

        return UserServiceResult<MessageResponse>.Success(
            new MessageResponse("Your password has been successfully configured. You can now log in to your account."));
    }

    public async Task<UserServiceResult<string>> ResendInvitationAsync(
        int userId,
        string? frontendBaseUrl,
        CancellationToken cancellationToken)
    {
        var user = await _context.Users.FindAsync([userId], cancellationToken);
        if (user == null)
        {
            return UserServiceResult<string>.NotFound("User not found.");
        }

        var tokenBytes = RandomNumberGenerator.GetBytes(32);
        var token = Convert.ToHexString(tokenBytes).ToLowerInvariant();

        user.InvitationToken = token;
        user.InvitationExpiresAtUtc = DateTimeOffset.UtcNow.AddHours(24);
        user.MustSetPassword = true;
        user.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        var baseUrl = !string.IsNullOrWhiteSpace(frontendBaseUrl) ? frontendBaseUrl.TrimEnd('/') : "http://localhost:5173";
        var setupUrl = $"{baseUrl}/#set-password?token={token}&email={Uri.EscapeDataString(user.Email)}";

        await _emailService.SendInvitationEmailAsync(user.Email, user.Username, token, setupUrl, cancellationToken);

        return UserServiceResult<string>.Success(setupUrl);
    }

    public Task<UserServiceResult<TwoFactorSetupResponse>> SetupTwoFactorAsync(
        int userId,
        string? ipAddress,
        CancellationToken cancellationToken) =>
        _twoFactorService.SetupTwoFactorAsync(userId, ipAddress, cancellationToken);

    public Task<UserServiceResult<MessageResponse>> EnableTwoFactorAsync(
        int userId,
        EnableTwoFactorRequest request,
        string? ipAddress,
        CancellationToken cancellationToken) =>
        _twoFactorService.EnableTwoFactorAsync(userId, request, ipAddress, cancellationToken);

    public Task<UserServiceResult<LoginResponse>> VerifyTwoFactorLoginAsync(
        VerifyTwoFactorRequest request,
        string? ipAddress,
        CancellationToken cancellationToken) =>
        _twoFactorService.VerifyTwoFactorLoginAsync(request, ipAddress, cancellationToken);

    public Task<UserServiceResult<MessageResponse>> DisableTwoFactorAsync(
        int userId,
        EnableTwoFactorRequest request,
        string? ipAddress,
        CancellationToken cancellationToken) =>
        _twoFactorService.DisableTwoFactorAsync(userId, request, ipAddress, cancellationToken);

    private static bool IsValidEmail(string email)
    {
        try
        {
            var mailAddress = new MailAddress(email);
            return mailAddress.Address == email && email.Contains('.');
        }
        catch
        {
            return false;
        }
    }
}

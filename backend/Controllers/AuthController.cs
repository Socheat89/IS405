using System.Security.Claims;
using backend.Data;
using backend.Models.Data;
using backend.Models.Request;
using backend.Modules.Audit.Services;
using backend.Services;
using backend.Services.QrAuth;
using backend.Services.TwoFactor;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/auth")]
[EnableRateLimiting("AuthRateLimit")]
public class AuthController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly ITwoFactorService _twoFactorService;
    private readonly IAuditService _auditService;
    private readonly IQrLoginService _qrLoginService;
    private readonly ITrustedDeviceService _trustedDeviceService;
    private readonly ITokenService _tokenService;
    private readonly AppDbContext _context;
    private readonly PasswordHasher<AppUser> _passwordHasher = new();

    public AuthController(
        IUserService userService,
        ITwoFactorService twoFactorService,
        IAuditService auditService,
        IQrLoginService qrLoginService,
        ITrustedDeviceService trustedDeviceService,
        ITokenService tokenService,
        AppDbContext context)
    {
        _userService = userService;
        _twoFactorService = twoFactorService;
        _auditService = auditService;
        _qrLoginService = qrLoginService;
        _trustedDeviceService = trustedDeviceService;
        _tokenService = tokenService;
        _context = context;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _userService.RegisterAsync(request, ipAddress, cancellationToken);

        if (!result.Succeeded)
        {
            await _auditService.LogAsync(
                action: "AUTH_REGISTER_FAILED",
                entityName: "AppUser",
                entityId: null,
                description: $"Registration failed for '{request.Username}': {result.Message}",
                userId: null,
                username: request.Username,
                ipAddress: ipAddress,
                cancellationToken: cancellationToken);

            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        await _auditService.LogAsync(
            action: "AUTH_REGISTER_SUCCESS",
            entityName: "AppUser",
            entityId: result.Value?.Id.ToString(),
            description: $"New user registered: '{request.Username}'",
            userId: result.Value?.Id,
            username: request.Username,
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return StatusCode(StatusCodes.Status201Created, result.Value);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status423Locked)]
    public async Task<IActionResult> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _userService.LoginAsync(request, ipAddress, cancellationToken);

        if (!result.Succeeded)
        {
            await _auditService.LogAsync(
                action: result.StatusCode == StatusCodes.Status423Locked ? "AUTH_ACCOUNT_LOCKED" : "AUTH_LOGIN_FAILED",
                entityName: "AppUser",
                entityId: null,
                description: $"Login failed for username '{request.Username}'. Status: {result.StatusCode}",
                userId: null,
                username: request.Username,
                ipAddress: ipAddress,
                cancellationToken: cancellationToken);

            if (result.StatusCode == StatusCodes.Status423Locked)
            {
                return StatusCode(StatusCodes.Status423Locked, new
                {
                    message = result.Message,
                    lockoutEndUtc = result.LockoutEndUtc
                });
            }

            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        await _auditService.LogAsync(
            action: "AUTH_LOGIN_SUCCESS",
            entityName: "AppUser",
            entityId: null,
            description: $"Successful login for user '{request.Username}' (2FA required: {result.Value?.RequiresTwoFactor})",
            userId: null,
            username: request.Username,
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return Ok(result.Value);
    }

    [HttpPost("2fa/setup")]
    [Authorize]
    [ProducesResponseType(typeof(TwoFactorSetupResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> SetupTwoFactor(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { message = "Missing or invalid access token" });
        }

        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _twoFactorService.SetupTwoFactorAsync(userId.Value, ipAddress, cancellationToken);

        if (!result.Succeeded)
        {
            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        await _auditService.LogAsync(
            action: "AUTH_2FA_SETUP",
            entityName: "AppUser",
            entityId: userId.Value.ToString(),
            description: "2FA TOTP setup initialized",
            userId: userId.Value,
            username: GetCurrentUsername(),
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return Ok(result.Value);
    }

    [HttpPost("2fa/enable")]
    [Authorize]
    [ProducesResponseType(typeof(MessageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> EnableTwoFactor(
        [FromBody] EnableTwoFactorRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { message = "Missing or invalid access token" });
        }

        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _twoFactorService.EnableTwoFactorAsync(userId.Value, request, ipAddress, cancellationToken);

        if (!result.Succeeded)
        {
            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        await _auditService.LogAsync(
            action: "AUTH_2FA_ENABLED",
            entityName: "AppUser",
            entityId: userId.Value.ToString(),
            description: "2FA successfully enabled and verified",
            userId: userId.Value,
            username: GetCurrentUsername(),
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return Ok(result.Value);
    }

    [HttpPost("2fa/verify-login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status423Locked)]
    public async Task<IActionResult> VerifyTwoFactorLogin(
        [FromBody] VerifyTwoFactorRequest request,
        CancellationToken cancellationToken)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _twoFactorService.VerifyTwoFactorLoginAsync(request, ipAddress, cancellationToken);

        if (!result.Succeeded)
        {
            await _auditService.LogAsync(
                action: result.StatusCode == StatusCodes.Status423Locked ? "AUTH_2FA_LOCKED" : "AUTH_2FA_FAILED",
                entityName: "AppUser",
                entityId: null,
                description: $"2FA login verification failed. Status: {result.StatusCode}",
                userId: null,
                username: null,
                ipAddress: ipAddress,
                cancellationToken: cancellationToken);

            if (result.StatusCode == StatusCodes.Status423Locked)
            {
                return StatusCode(StatusCodes.Status423Locked, new
                {
                    message = result.Message,
                    lockoutEndUtc = result.LockoutEndUtc
                });
            }

            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        await _auditService.LogAsync(
            action: "AUTH_2FA_VERIFIED",
            entityName: "AppUser",
            entityId: null,
            description: "2FA verification succeeded; issued full access token",
            userId: null,
            username: null,
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return Ok(result.Value);
    }

    [HttpGet("validate-invitation")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ValidateInvitationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ValidateInvitation(
        [FromQuery] string token,
        [FromQuery] string email,
        CancellationToken cancellationToken)
    {
        var result = await _userService.ValidateInvitationAsync(token, email, cancellationToken);
        if (!result.Succeeded)
        {
            return StatusCode(result.StatusCode, new { message = result.Message });
        }
        return Ok(result.Value);
    }

    [HttpPost("set-password")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(MessageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SetPassword(
        [FromBody] SetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _userService.SetPasswordAsync(request, ipAddress, cancellationToken);

        if (!result.Succeeded)
        {
            await _auditService.LogAsync(
                action: "AUTH_SET_PASSWORD_FAILED",
                entityName: "AppUser",
                entityId: null,
                description: $"Password setup failed for email '{request.Email}': {result.Message}",
                userId: null,
                username: request.Email,
                ipAddress: ipAddress,
                cancellationToken: cancellationToken);

            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        await _auditService.LogAsync(
            action: "AUTH_SET_PASSWORD_SUCCESS",
            entityName: "AppUser",
            entityId: null,
            description: $"Password successfully set for user '{request.Email}' via invitation token",
            userId: null,
            username: request.Email,
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return Ok(result.Value);
    }

    [HttpPost("2fa/disable")]
    [Authorize]
    [ProducesResponseType(typeof(MessageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> DisableTwoFactor(
        [FromBody] EnableTwoFactorRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { message = "Missing or invalid access token" });
        }

        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _twoFactorService.DisableTwoFactorAsync(userId.Value, request, ipAddress, cancellationToken);

        if (!result.Succeeded)
        {
            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        await _auditService.LogAsync(
            action: "AUTH_2FA_DISABLED",
            entityName: "AppUser",
            entityId: userId.Value.ToString(),
            description: "2FA authentication was disabled",
            userId: userId.Value,
            username: GetCurrentUsername(),
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return Ok(result.Value);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser([FromServices] AppDbContext context, CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Unauthorized" });

        var user = await context.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.UserWarehouses).ThenInclude(uw => uw.Warehouse)
            .FirstOrDefaultAsync(u => u.Id == userId.Value, cancellationToken);

        if (user == null) return NotFound(new { message = "User not found" });

        var roles = user.UserRoles.Where(ur => ur.Role != null && ur.Role.IsActive).Select(ur => ur.Role.Code).ToList();
        var isRootAdmin = roles.Contains("ADMIN") || roles.Contains("ADMINISTRATOR");

        var userWarehouses = user.UserWarehouses
            .Where(uw => uw.Warehouse != null && uw.Warehouse.IsActive)
            .Select(uw => new
            {
                id = uw.WarehouseId,
                code = uw.Warehouse!.Code,
                name = uw.Warehouse.Name,
                isDefault = uw.IsDefault
            })
            .ToList();

        var allowedWarehouseIds = isRootAdmin ? null : userWarehouses.Select(w => w.id).ToList();

        return Ok(new
        {
            id = user.Id,
            username = user.Username,
            email = user.Email,
            twoFactorEnabled = user.TwoFactorEnabled,
            roles = roles,
            isAdmin = isRootAdmin,
            assignedWarehouses = userWarehouses,
            allowedWarehouseIds = allowedWarehouseIds,
            defaultWarehouseId = userWarehouses.FirstOrDefault(w => w.isDefault)?.id ?? userWarehouses.FirstOrDefault()?.id
        });
    }

    [HttpPost("qr/generate")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(QrGenerateResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GenerateQr(
        [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] QrGenerateRequest? request,
        CancellationToken cancellationToken)
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        string baseUrl = request?.ClientBaseUrl?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            var origin = Request.Headers.Origin.FirstOrDefault()
                      ?? Request.Headers.Referer.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(origin))
            {
                baseUrl = origin.TrimEnd('/');
            }
            else
            {
                var scheme = Request.Scheme ?? "http";
                var host = Request.Headers.Host.FirstOrDefault() ?? "localhost:5173";
                baseUrl = $"{scheme}://{host}";
            }
        }

        var session = _qrLoginService.CreateSession(clientIp, userAgent, baseUrl);

        await _auditService.LogAsync(
            action: "AUTH_QR_LOGIN_INITIATED",
            entityName: "AppUser",
            entityId: null,
            description: $"QR login session initiated from IP: {clientIp}",
            userId: null,
            username: null,
            ipAddress: clientIp,
            cancellationToken: cancellationToken);

        var expiresIn = (int)Math.Max(0, (session.ExpiresAtUtc - DateTimeOffset.UtcNow).TotalSeconds);

        return Ok(new QrGenerateResponse
        {
            QrToken = session.QrToken,
            ApprovalUrl = session.ApprovalUrl ?? $"{baseUrl}/#qr-approve?token={session.QrToken}",
            QrCodeDataUrl = session.QrCodeDataUrl,
            ExpiresAtUtc = session.ExpiresAtUtc,
            ExpiresInSeconds = expiresIn
        });
    }

    [HttpGet("qr/status")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(QrStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetQrStatus(
        [FromQuery] string qrToken,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(qrToken))
        {
            return BadRequest(new { message = "qrToken is required" });
        }

        var session = _qrLoginService.GetSession(qrToken);
        if (session == null)
        {
            return NotFound(new { message = "QR session not found or expired" });
        }

        if (session.Status == "Approved")
        {
            UserResponse? userResponse = null;
            if (session.ApprovedUserId.HasValue && !string.IsNullOrEmpty(session.ApprovedUsername))
            {
                userResponse = new UserResponse(
                    session.ApprovedUserId.Value,
                    session.ApprovedUsername,
                    session.ApprovedEmail ?? $"{session.ApprovedUsername}@company.com"
                );
            }

            return Ok(new QrStatusResponse
            {
                Status = "Approved",
                AccessToken = session.AccessToken,
                User = userResponse,
                Message = "Login approved by phone",
                ExpiresAtUtc = session.AccessTokenExpiresAt
            });
        }

        return Ok(new QrStatusResponse
        {
            Status = session.Status,
            AccessToken = null,
            User = null,
            Message = session.Status switch
            {
                "Pending" => "Waiting for phone scan...",
                "Scanned" => "QR scanned! Awaiting approval on phone...",
                "Expired" => "QR code expired. Please generate a new one.",
                "Rejected" => session.RejectReason ?? "Login request was rejected.",
                _ => session.Status
            },
            ExpiresAtUtc = session.ExpiresAtUtc
        });
    }

    [HttpGet("qr/session-info")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(QrSessionInfoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetQrSessionInfo([FromQuery] string qrToken)
    {
        if (string.IsNullOrWhiteSpace(qrToken))
        {
            return BadRequest(new { message = "qrToken is required" });
        }

        var session = _qrLoginService.GetSession(qrToken);
        if (session == null)
        {
            return NotFound(new { message = "QR session not found or expired" });
        }

        if (session.Status == "Pending")
        {
            _qrLoginService.MarkScanned(qrToken, HttpContext.Connection.RemoteIpAddress?.ToString());
        }

        return Ok(new QrSessionInfoResponse
        {
            QrToken = session.QrToken,
            Status = session.Status,
            DeviceIp = session.DeviceIp,
            UserAgent = session.UserAgent,
            CreatedAtUtc = session.CreatedAtUtc,
            ExpiresAtUtc = session.ExpiresAtUtc,
            IsExpired = DateTimeOffset.UtcNow > session.ExpiresAtUtc
        });
    }

    [HttpPost("qr/scan")]
    [AllowAnonymous]
    public IActionResult MarkQrScanned([FromBody] QrApproveRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.QrToken))
        {
            return BadRequest(new { message = "qrToken is required" });
        }

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var success = _qrLoginService.MarkScanned(request.QrToken, ip);
        return Ok(new { success });
    }

    [HttpPost("qr/check-device")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(CheckDeviceResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> CheckDevice([FromBody] CheckDeviceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.DeviceId) || string.IsNullOrWhiteSpace(request?.DeviceSecret))
        {
            return Ok(new CheckDeviceResponse { IsTrusted = false, Message = "Device credentials missing" });
        }

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var record = await _trustedDeviceService.ValidateDeviceAsync(request.DeviceId, request.DeviceSecret, ip);

        if (record == null)
        {
            return Ok(new CheckDeviceResponse
            {
                IsTrusted = false,
                Message = "This device is not recognized or has been unlinked."
            });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == record.UserId && u.IsActive);
        if (user == null)
        {
            return Ok(new CheckDeviceResponse
            {
                IsTrusted = false,
                Message = "User account not found or deactivated."
            });
        }

        return Ok(new CheckDeviceResponse
        {
            IsTrusted = true,
            User = new UserResponse(user.Id, user.Username, user.Email),
            DeviceName = record.DeviceName,
            Message = "Device recognized and trusted."
        });
    }

    [HttpPost("qr/approve")]
    [AllowAnonymous]
    public async Task<IActionResult> ApproveQr(
        [FromBody] QrApproveRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request?.QrToken))
        {
            return BadRequest(new { message = "qrToken is required" });
        }

        var session = _qrLoginService.GetSession(request.QrToken);
        if (session == null)
        {
            return NotFound(new { message = "QR session expired or not found" });
        }

        if (session.Status == "Expired" || DateTimeOffset.UtcNow > session.ExpiresAtUtc)
        {
            return BadRequest(new { message = "This QR code has expired. Please refresh the QR code on desktop." });
        }

        if (session.Status == "Approved")
        {
            return BadRequest(new { message = "This QR code has already been approved." });
        }

        AppUser? user = null;
        TrustedDeviceDto? pairedDevice = null;
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        // 1. Trusted Device Flow (1-tap approve without password!)
        if (!string.IsNullOrWhiteSpace(request.DeviceId) && !string.IsNullOrWhiteSpace(request.DeviceSecret))
        {
            var deviceRecord = await _trustedDeviceService.ValidateDeviceAsync(request.DeviceId, request.DeviceSecret, ipAddress);
            if (deviceRecord != null)
            {
                user = await _context.Users
                    .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(u => u.Id == deviceRecord.UserId, cancellationToken);
            }
            else
            {
                return Unauthorized(new { message = "Device is not recognized or pairing has expired. Please log in with password." });
            }
        }
        // 2. Currently authenticated Bearer token user
        else if (GetCurrentUserId() is int currentUserId)
        {
            user = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == currentUserId, cancellationToken);
        }
        // 3. First-time or new device: username & password authentication
        else if (!string.IsNullOrWhiteSpace(request.Username) && !string.IsNullOrWhiteSpace(request.Password))
        {
            var usernameTrimmed = request.Username.Trim().ToLowerInvariant();
            user = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Username.ToLower() == usernameTrimmed || u.Email.ToLower() == usernameTrimmed, cancellationToken);

            if (user == null || !user.IsActive)
            {
                return Unauthorized(new { message = "Invalid username or password" });
            }

            var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
            if (verifyResult == PasswordVerificationResult.Failed)
            {
                return Unauthorized(new { message = "Invalid username or password" });
            }

            // Register as trusted device if requested (default true)
            if (request.TrustThisDevice)
            {
                var newDevice = await _trustedDeviceService.RegisterDeviceAsync(
                    user.Id,
                    user.Username,
                    user.Email,
                    request.DeviceName,
                    ipAddress);

                pairedDevice = new TrustedDeviceDto
                {
                    DeviceId = newDevice.DeviceId,
                    DeviceSecret = newDevice.DeviceSecret,
                    Username = user.Username,
                    Email = user.Email,
                    DeviceName = newDevice.DeviceName
                };
            }
        }
        else
        {
            return Unauthorized(new { message = "Authentication required to approve login." });
        }

        if (user == null || !user.IsActive)
        {
            return Unauthorized(new { message = "User not found or account is deactivated" });
        }

        if (user.LockoutEndUtc.HasValue && user.LockoutEndUtc.Value > DateTimeOffset.UtcNow)
        {
            return StatusCode(StatusCodes.Status423Locked, new { message = "Account is temporarily locked" });
        }

        var roles = user.UserRoles
            .Where(ur => ur.Role != null && ur.Role.IsActive)
            .Select(ur => ur.Role.Code)
            .ToList();

        var (accessToken, expiresAt) = _tokenService.GenerateAccessToken(user, roles);

        var approved = _qrLoginService.ApproveSession(request.QrToken, user, accessToken, expiresAt);
        if (!approved)
        {
            return BadRequest(new { message = "Could not approve session. It may have expired." });
        }

        await _auditService.LogAsync(
            action: "AUTH_QR_LOGIN_APPROVED",
            entityName: "AppUser",
            entityId: user.Id.ToString(),
            description: $"QR login approved for user '{user.Username}' (device: {request.DeviceId ?? "unpaired"}) from IP {ipAddress}",
            userId: user.Id,
            username: user.Username,
            ipAddress: ipAddress,
            cancellationToken: cancellationToken);

        return Ok(new QrApproveResponse
        {
            Success = true,
            Message = "QR Login approved successfully",
            Username = user.Username,
            Roles = roles,
            TrustedDevice = pairedDevice
        });
    }

    [HttpPost("qr/revoke-device")]
    [AllowAnonymous]
    public async Task<IActionResult> RevokeDevice([FromBody] RevokeDeviceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.DeviceId))
        {
            return BadRequest(new { message = "DeviceId is required" });
        }

        var revoked = await _trustedDeviceService.RevokeDeviceAsync(request.DeviceId, request.DeviceSecret);
        return Ok(new { success = revoked, message = revoked ? "Device unlinked successfully" : "Could not unlink device" });
    }

    [HttpPost("qr/reject")]
    [AllowAnonymous]
    public async Task<IActionResult> RejectQr(
        [FromBody] QrRejectRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request?.QrToken))
        {
            return BadRequest(new { message = "qrToken is required" });
        }

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        _qrLoginService.RejectSession(request.QrToken, request.Reason);

        await _auditService.LogAsync(
            action: "AUTH_QR_LOGIN_REJECTED",
            entityName: "AppUser",
            entityId: null,
            description: $"QR login request was rejected. Reason: {request.Reason ?? "Rejected by user"}",
            userId: GetCurrentUserId(),
            username: GetCurrentUsername(),
            ipAddress: ip,
            cancellationToken: cancellationToken);

        return Ok(new { success = true, message = "Login request rejected" });
    }

    private int? GetCurrentUserId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                   ?? User.FindFirst("sub")?.Value;

        if (int.TryParse(idClaim, out var userId))
        {
            return userId;
        }

        return null;
    }

    private string? GetCurrentUsername() =>
        User.FindFirst(ClaimTypes.Name)?.Value
        ?? User.FindFirst("name")?.Value
        ?? User.Identity?.Name;
}

using System.Security.Claims;
using backend.Data;
using backend.Models.Request;
using backend.Modules.Audit.Services;
using backend.Services;
using backend.Services.TwoFactor;
using Microsoft.AspNetCore.Authorization;
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

    public AuthController(
        IUserService userService,
        ITwoFactorService twoFactorService,
        IAuditService auditService)
    {
        _userService = userService;
        _twoFactorService = twoFactorService;
        _auditService = auditService;
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
            roles = roles,
            isAdmin = isRootAdmin,
            assignedWarehouses = userWarehouses,
            allowedWarehouseIds = allowedWarehouseIds,
            defaultWarehouseId = userWarehouses.FirstOrDefault(w => w.isDefault)?.id ?? userWarehouses.FirstOrDefault()?.id
        });
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

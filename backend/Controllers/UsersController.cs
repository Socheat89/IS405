using System.Security.Claims;
using System.Security.Cryptography;
using backend.Data;
using backend.Models.Data;
using backend.Models.Request;
using backend.Modules.Audit.Services;
using backend.Services;
using backend.Services.Common;
using backend.Services.Email;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OtpNet;

namespace backend.Controllers;

[ApiController]
[Route("api/users")]
[Authorize("FullAuth")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;
    private readonly IUserService _userService;
    private readonly IEmailService _emailService;
    private readonly IConfiguration _configuration;
    private readonly PasswordHasher<AppUser> _passwordHasher = new();

    public UsersController(
        AppDbContext context,
        IAuditService auditService,
        IUserService userService,
        IEmailService emailService,
        IConfiguration configuration)
    {
        _context = context;
        _auditService = auditService;
        _userService = userService;
        _emailService = emailService;
        _configuration = configuration;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<UserDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        if (!await IsAdminOrHasPermissionAsync("users.view", cancellationToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You do not have permission to view users." });
        }

        var users = await _context.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .Include(u => u.UserPermissions)
            .ThenInclude(up => up.Permission)
            .Include(u => u.UserWarehouses)
            .ThenInclude(uw => uw.Warehouse)
            .OrderBy(u => u.Id)
            .ToListAsync(cancellationToken);

        var allPermissions = await _context.Permissions
            .Where(p => p.IsActive)
            .ToListAsync(cancellationToken);

        var allRolePermissions = await _context.RolePermissions
            .Include(rp => rp.Permission)
            .ToListAsync(cancellationToken);

        var frontendBaseUrl = GetFrontendBaseUrl();
        var result = new List<UserDto>();
        foreach (var user in users)
        {
            var dto = MapToUserDto(user, allPermissions, allRolePermissions, frontendBaseUrl);
            result.Add(dto);
        }

        return Ok(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateUserWithRolesRequest request,
        CancellationToken cancellationToken)
    {
        if (!await IsAdminOrHasPermissionAsync("users.create", cancellationToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You do not have permission to create users." });
        }

        if (string.IsNullOrWhiteSpace(request.Username) || request.Username.Trim().Length < 3 || request.Username.Trim().Length > 100)
        {
            return BadRequest(new { message = "Username must be between 3 and 100 characters." });
        }

        if (string.IsNullOrWhiteSpace(request.Email) || !IsValidEmail(request.Email.Trim()))
        {
            return BadRequest(new { message = "A valid email address is required." });
        }

        var hasExplicitPassword = !string.IsNullOrWhiteSpace(request.Password);
        if (hasExplicitPassword)
        {
            var (isValidPassword, passwordError) = PasswordPolicy.Validate(request.Password);
            if (!isValidPassword)
            {
                return BadRequest(new { message = passwordError ?? "Password does not meet strong security requirements." });
            }
        }

        var cleanUsername = request.Username.Trim();
        var cleanEmail = request.Email.Trim().ToLowerInvariant();

        var exists = await _context.Users
            .Where(u => u.Username.ToLower() == cleanUsername.ToLower() || u.Email.ToLower() == cleanEmail)
            .Select(u => u.Id)
            .FirstOrDefaultAsync(cancellationToken) > 0;

        if (exists)
        {
            return Conflict(new { message = "Username or email is already in use." });
        }

        // Security check: Only an ADMIN can assign the ADMIN role to a new user
        var adminRoleId = await _context.Roles
            .Where(r => r.Code == "ADMIN" && r.IsActive)
            .Select(r => r.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (!User.IsInRole("ADMIN") && request.RoleIds.Contains(adminRoleId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only administrators can assign the Administrator role." });
        }

        var actorUserId = GetCurrentUserId() ?? 1;

        var user = new AppUser
        {
            Username = cleanUsername,
            Email = cleanEmail,
            PasswordHash = string.Empty,
            IsActive = true,
            TwoFactorEnabled = false,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        string? invitationToken = null;
        string? invitationUrl = null;

        if (hasExplicitPassword)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password!);
            user.MustSetPassword = false;
        }
        else
        {
            // Admin only entered email and name -> Generate invitation token and email
            var tokenBytes = RandomNumberGenerator.GetBytes(32);
            invitationToken = Convert.ToHexString(tokenBytes).ToLowerInvariant();
            user.InvitationToken = invitationToken;
            user.InvitationExpiresAtUtc = DateTimeOffset.UtcNow.AddHours(24);
            user.MustSetPassword = true;
            // Generate secure random placeholder hash
            user.PasswordHash = _passwordHasher.HashPassword(user, Guid.NewGuid().ToString("N") + "!Aa9#");

            var frontendBaseUrl = GetFrontendBaseUrl();
            invitationUrl = $"{frontendBaseUrl}/#set-password?token={invitationToken}&email={Uri.EscapeDataString(cleanEmail)}";
        }

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        // Assign roles
        if (request.RoleIds.Count > 0)
        {
            var validRoleIds = await _context.Roles
                .Where(r => request.RoleIds.Contains(r.Id) && r.IsActive)
                .Select(r => r.Id)
                .ToListAsync(cancellationToken);

            foreach (var roleId in validRoleIds)
            {
                _context.UserRoles.Add(new AppUserRole
                {
                    UserId = user.Id,
                    RoleId = roleId,
                    AssignedAtUtc = DateTimeOffset.UtcNow,
                    AssignedBy = actorUserId
                });
            }
        }

        // Assign direct permissions
        if (request.DirectPermissionIds.Count > 0)
        {
            var validPermIds = await _context.Permissions
                .Where(p => request.DirectPermissionIds.Contains(p.Id) && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync(cancellationToken);

            foreach (var permId in validPermIds)
            {
                _context.UserPermissions.Add(new AppUserPermission
                {
                    UserId = user.Id,
                    PermissionId = permId,
                    AssignedAtUtc = DateTimeOffset.UtcNow,
                    AssignedBy = actorUserId
                });
            }
        }

        // Assign warehouses
        if (request.WarehouseIds != null && request.WarehouseIds.Count > 0)
        {
            var validWarehouseIds = await _context.Warehouses
                .Where(w => request.WarehouseIds.Contains(w.Id) && w.IsActive)
                .Select(w => w.Id)
                .ToListAsync(cancellationToken);

            foreach (var whId in validWarehouseIds)
            {
                _context.UserWarehouses.Add(new AppUserWarehouse
                {
                    UserId = user.Id,
                    WarehouseId = whId,
                    IsDefault = request.DefaultWarehouseId.HasValue ? whId == request.DefaultWarehouseId.Value : whId == validWarehouseIds.First(),
                    AssignedAtUtc = DateTimeOffset.UtcNow,
                    AssignedBy = actorUserId
                });
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Send email invite if applicable
        if (user.MustSetPassword && invitationToken != null && invitationUrl != null)
        {
            await _emailService.SendInvitationEmailAsync(
                user.Email,
                user.Username,
                invitationToken,
                invitationUrl,
                cancellationToken);
        }

        await _auditService.LogAsync(
            action: "CREATE_USER",
            entityName: "AppUser",
            entityId: user.Id.ToString(),
            description: $"User account '{user.Username}' was created by '{GetCurrentUsername()}' (Invite email sent: {user.MustSetPassword})",
            userId: actorUserId,
            username: GetCurrentUsername(),
            ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString(),
            cancellationToken: cancellationToken);

        var createdUser = await GetUserByIdWithDetailsAsync(user.Id, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, createdUser);
    }

    [HttpPost("{id:int}/resend-invitation")]
    [ProducesResponseType(typeof(MessageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ResendInvitation(int id, CancellationToken cancellationToken)
    {
        if (!await IsAdminOrHasPermissionAsync("users.create", cancellationToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You do not have permission to resend invitations." });
        }

        var frontendBaseUrl = GetFrontendBaseUrl();
        var result = await _userService.ResendInvitationAsync(id, frontendBaseUrl, cancellationToken);

        if (!result.Succeeded)
        {
            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        await _auditService.LogAsync(
            action: "RESEND_USER_INVITATION",
            entityName: "AppUser",
            entityId: id.ToString(),
            description: $"Invitation email was re-sent for user ID {id} by '{GetCurrentUsername()}'",
            userId: GetCurrentUserId() ?? 1,
            username: GetCurrentUsername(),
            ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString(),
            cancellationToken: cancellationToken);

        return Ok(new MessageResponse($"Invitation email successfully resent. Setup link: {result.Value}"));
    }

    [HttpPut("{id:int}/roles")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateRoles(
        int id,
        [FromBody] UpdateUserRolesRequest request,
        CancellationToken cancellationToken)
    {
        if (!await IsAdminOrHasPermissionAsync("users.edit", cancellationToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You do not have permission to edit user roles." });
        }

        var user = await _context.Users
            .Include(u => u.UserRoles)
            .Include(u => u.UserPermissions)
            .Include(u => u.UserWarehouses)
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user == null)
        {
            return NotFound(new { message = "User not found." });
        }

        var actorUserId = GetCurrentUserId() ?? 1;

        // Security check: Last Admin protection (cannot remove ADMIN role from the only active administrator)
        var adminRoleId = await _context.Roles
            .Where(r => r.Code == "ADMIN" && r.IsActive)
            .Select(r => r.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var isCurrentlyAdmin = user.UserRoles.Any(ur => ur.RoleId == adminRoleId);
        var willBeAdmin = request.RoleIds.Contains(adminRoleId);

        if (isCurrentlyAdmin && !willBeAdmin)
        {
            var otherActiveAdminsCount = await _context.UserRoles
                .Where(ur => ur.RoleId == adminRoleId && ur.UserId != id && ur.User.IsActive)
                .CountAsync(cancellationToken);

            if (otherActiveAdminsCount == 0)
            {
                return BadRequest(new { message = "Cannot remove the Administrator role from the last active administrator." });
            }
        }

        // Security check: Only an ADMIN can grant the ADMIN role
        if (!User.IsInRole("ADMIN") && willBeAdmin && !isCurrentlyAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only administrators can grant the Administrator role." });
        }

        // Update roles
        _context.UserRoles.RemoveRange(user.UserRoles);

        var validRoleIds = await _context.Roles
            .Where(r => request.RoleIds.Contains(r.Id) && r.IsActive)
            .Select(r => r.Id)
            .ToListAsync(cancellationToken);

        foreach (var roleId in validRoleIds)
        {
            _context.UserRoles.Add(new AppUserRole
            {
                UserId = user.Id,
                RoleId = roleId,
                AssignedAtUtc = DateTimeOffset.UtcNow,
                AssignedBy = actorUserId
            });
        }

        // Update direct permissions
        _context.UserPermissions.RemoveRange(user.UserPermissions);

        if (request.DirectPermissionIds.Count > 0)
        {
            var validPermIds = await _context.Permissions
                .Where(p => request.DirectPermissionIds.Contains(p.Id) && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync(cancellationToken);

            foreach (var permId in validPermIds)
            {
                _context.UserPermissions.Add(new AppUserPermission
                {
                    UserId = user.Id,
                    PermissionId = permId,
                    AssignedAtUtc = DateTimeOffset.UtcNow,
                    AssignedBy = actorUserId
                });
            }
        }

        // Update warehouses
        _context.UserWarehouses.RemoveRange(user.UserWarehouses);

        if (request.WarehouseIds != null && request.WarehouseIds.Count > 0)
        {
            var validWarehouseIds = await _context.Warehouses
                .Where(w => request.WarehouseIds.Contains(w.Id) && w.IsActive)
                .Select(w => w.Id)
                .ToListAsync(cancellationToken);

            foreach (var whId in validWarehouseIds)
            {
                _context.UserWarehouses.Add(new AppUserWarehouse
                {
                    UserId = user.Id,
                    WarehouseId = whId,
                    IsDefault = request.DefaultWarehouseId.HasValue ? whId == request.DefaultWarehouseId.Value : whId == validWarehouseIds.First(),
                    AssignedAtUtc = DateTimeOffset.UtcNow,
                    AssignedBy = actorUserId
                });
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "UPDATE_USER_ROLES",
            entityName: "AppUser",
            entityId: id.ToString(),
            description: $"Updated roles and permissions for user '{user.Username}'",
            userId: actorUserId,
            username: GetCurrentUsername(),
            ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString(),
            cancellationToken: cancellationToken);

        var updatedUser = await GetUserByIdWithDetailsAsync(id, cancellationToken);
        return Ok(updatedUser);
    }

    [HttpPut("{id:int}/status")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleStatus(int id, CancellationToken cancellationToken)
    {
        if (!await IsAdminOrHasPermissionAsync("users.delete", cancellationToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You do not have permission to modify user status." });
        }

        var user = await _context.Users.FindAsync([id], cancellationToken);
        if (user == null)
        {
            return NotFound(new { message = "User not found." });
        }

        var actorUserId = GetCurrentUserId() ?? 1;

        // Security check: Last Admin protection (cannot deactivate the only active administrator)
        if (user.IsActive)
        {
            var adminRoleId = await _context.Roles
                .Where(r => r.Code == "ADMIN" && r.IsActive)
                .Select(r => r.Id)
                .FirstOrDefaultAsync(cancellationToken);

            var isAdmin = await _context.UserRoles.AnyAsync(ur => ur.UserId == id && ur.RoleId == adminRoleId, cancellationToken);
            if (isAdmin)
            {
                var activeAdminsCount = await _context.UserRoles
                    .Where(ur => ur.RoleId == adminRoleId && ur.User.IsActive)
                    .CountAsync(cancellationToken);

                if (activeAdminsCount <= 1)
                {
                    return BadRequest(new { message = "Cannot deactivate the last active administrator account." });
                }
            }
        }

        user.IsActive = !user.IsActive;
        user.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: user.IsActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
            entityName: "AppUser",
            entityId: id.ToString(),
            description: $"User account '{user.Username}' status changed to {(user.IsActive ? "Active" : "Disabled")}",
            userId: actorUserId,
            username: GetCurrentUsername(),
            ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString(),
            cancellationToken: cancellationToken);

        var dto = await GetUserByIdWithDetailsAsync(id, cancellationToken);
        return Ok(dto);
    }

    [HttpPut("{id:int}/2fa")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleTwoFactor(int id, CancellationToken cancellationToken)
    {
        if (!await IsAdminOrHasPermissionAsync("users.edit", cancellationToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You do not have permission to manage two-factor authentication." });
        }

        var user = await _context.Users.FindAsync([id], cancellationToken);
        if (user == null)
        {
            return NotFound(new { message = "User not found." });
        }

        var actorUserId = GetCurrentUserId() ?? 1;

        user.TwoFactorEnabled = !user.TwoFactorEnabled;
        if (!user.TwoFactorEnabled)
        {
            user.TwoFactorSecret = null;
        }
        else if (string.IsNullOrEmpty(user.TwoFactorSecret))
        {
            var secretBytes = KeyGeneration.GenerateRandomKey(20);
            user.TwoFactorSecret = Base32Encoding.ToString(secretBytes);
        }

        user.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: user.TwoFactorEnabled ? "ENABLE_2FA" : "DISABLE_2FA",
            entityName: "AppUser",
            entityId: id.ToString(),
            description: $"Two-factor authentication {(user.TwoFactorEnabled ? "enabled" : "disabled")} for user '{user.Username}'",
            userId: actorUserId,
            username: GetCurrentUsername(),
            ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString(),
            cancellationToken: cancellationToken);

        var dto = await GetUserByIdWithDetailsAsync(id, cancellationToken);
        return Ok(dto);
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        if (!await IsAdminOrHasPermissionAsync("users.delete", cancellationToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You do not have permission to delete users." });
        }

        var user = await _context.Users
            .Include(u => u.UserRoles)
            .Include(u => u.UserPermissions)
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user == null)
        {
            return NotFound(new { message = "User not found." });
        }

        var actorUserId = GetCurrentUserId() ?? 1;

        // Protection: cannot delete oneself
        if (id == actorUserId)
        {
            return BadRequest(new { message = "You cannot delete your own account." });
        }

        // Protection: cannot delete root admin
        if (user.Username.Equals("admin", StringComparison.OrdinalIgnoreCase) || user.Username.Equals("admin_2fa", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Cannot delete the default system administrator." });
        }

        _context.Users.Remove(user);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "DELETE_USER",
            entityName: "AppUser",
            entityId: id.ToString(),
            description: $"User account '{user.Username}' was deleted by '{GetCurrentUsername()}'",
            userId: actorUserId,
            username: GetCurrentUsername(),
            ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString(),
            cancellationToken: cancellationToken);

        return NoContent();
    }

    private async Task<UserDto> GetUserByIdWithDetailsAsync(int userId, CancellationToken cancellationToken)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .Include(u => u.UserPermissions)
            .ThenInclude(up => up.Permission)
            .Include(u => u.UserWarehouses)
            .ThenInclude(uw => uw.Warehouse)
            .FirstAsync(u => u.Id == userId, cancellationToken);

        var allPermissions = await _context.Permissions
            .Where(p => p.IsActive)
            .ToListAsync(cancellationToken);

        var allRolePermissions = await _context.RolePermissions
            .Include(rp => rp.Permission)
            .ToListAsync(cancellationToken);

        var frontendBaseUrl = GetFrontendBaseUrl();
        return MapToUserDto(user, allPermissions, allRolePermissions, frontendBaseUrl);
    }

    private static UserDto MapToUserDto(
        AppUser user,
        List<AppPermission> allPermissions,
        List<AppRolePermission> allRolePermissions,
        string? frontendBaseUrl = null)
    {
        var activeUserRoles = user.UserRoles?
            .Where(ur => ur.Role != null && ur.Role.IsActive)
            .ToList() ?? [];

        var roles = activeUserRoles
            .Select(ur => ur.Role.Name)
            .ToList();

        var roleIds = activeUserRoles
            .Select(ur => ur.RoleId)
            .ToList();

        var activeUserPermissions = user.UserPermissions?
            .Where(up => up.Permission != null && up.Permission.IsActive)
            .ToList() ?? [];

        var directPermIds = activeUserPermissions
            .Select(up => up.PermissionId)
            .ToList();

        var isAdmin = activeUserRoles.Any(ur => ur.Role.Code.Equals("ADMIN", StringComparison.OrdinalIgnoreCase));

        List<string> effectivePermCodes;
        if (isAdmin)
        {
            effectivePermCodes = allPermissions
                .Where(p => p != null && p.IsActive)
                .Select(p => p.Code)
                .Distinct()
                .ToList();
        }
        else if (activeUserPermissions.Count > 0)
        {
            effectivePermCodes = activeUserPermissions
                .Select(up => up.Permission.Code)
                .Distinct()
                .ToList();
        }
        else
        {
            effectivePermCodes = allRolePermissions
                .Where(rp => roleIds.Contains(rp.RoleId) && rp.Permission != null && rp.Permission.IsActive)
                .Select(rp => rp.Permission.Code)
                .Distinct()
                .ToList();
        }

        var assignedWarehouses = user.UserWarehouses?
            .Where(uw => uw.Warehouse != null && uw.Warehouse.IsActive)
            .ToList() ?? [];

        var warehouseIds = assignedWarehouses.Select(uw => uw.WarehouseId).ToList();
        var warehouseNames = assignedWarehouses.Select(uw => uw.Warehouse!.Name).ToList();
        var defaultWhId = assignedWarehouses.FirstOrDefault(uw => uw.IsDefault)?.WarehouseId
            ?? (warehouseIds.Count > 0 ? warehouseIds[0] : (int?)null);

        string? inviteLink = null;
        if (user.MustSetPassword && !string.IsNullOrEmpty(user.InvitationToken))
        {
            var baseUrl = frontendBaseUrl ?? "http://localhost:5173";
            inviteLink = $"{baseUrl}/#set-password?token={user.InvitationToken}&email={Uri.EscapeDataString(user.Email)}";
        }

        return new UserDto(
            user.Id,
            user.Username,
            user.Email,
            roles,
            roleIds,
            directPermIds,
            effectivePermCodes,
            user.IsActive,
            user.TwoFactorEnabled,
            user.CreatedAtUtc,
            user.MustSetPassword,
            inviteLink,
            warehouseIds,
            warehouseNames,
            defaultWhId);
    }

    private string GetFrontendBaseUrl()
    {
        var referer = Request.Headers.Referer.ToString();
        if (!string.IsNullOrWhiteSpace(referer) && Uri.TryCreate(referer, UriKind.Absolute, out var uri))
        {
            return $"{uri.Scheme}://{uri.Authority}";
        }

        var origin = Request.Headers.Origin.ToString();
        if (!string.IsNullOrWhiteSpace(origin))
        {
            return origin.TrimEnd('/');
        }

        return _configuration["Cors:AllowedOrigins:0"] ?? "http://localhost:5173";
    }

    private int? GetCurrentUserId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                   ?? User.FindFirst("sub")?.Value;
        return int.TryParse(idClaim, out var id) ? id : null;
    }

    private string? GetCurrentUsername() =>
        User.FindFirst(ClaimTypes.Name)?.Value
        ?? User.FindFirst("name")?.Value
        ?? User.Identity?.Name;

    private static bool IsValidEmail(string email)
    {
        try
        {
            var mailAddress = new System.Net.Mail.MailAddress(email);
            return mailAddress.Address == email && email.Contains('.');
        }
        catch
        {
            return false;
        }
    }

    private async Task<bool> IsAdminOrHasPermissionAsync(string permissionCode, CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return false;
        }

        return await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, permissionCode);
    }
}

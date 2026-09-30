using System.Security.Claims;
using backend.Models.Request;
using backend.Modules.Audit.Services;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/roles")]
[Authorize("FullAuth")]
public class RolesController : ControllerBase
{
    private readonly IRoleService _roleService;
    private readonly IAuditService _auditService;

    public RolesController(IRoleService roleService, IAuditService auditService)
    {
        _roleService = roleService;
        _auditService = auditService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(RolePageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetPage(
        [FromQuery] RoleQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _roleService.GetPageAsync(request, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(RoleResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(int id, CancellationToken cancellationToken)
    {
        var role = await _roleService.GetByIdAsync(id, cancellationToken);
        if (role == null)
        {
            return NotFound(new { message = "Role was not found" });
        }

        return Ok(role);
    }

    [HttpPost]
    [ProducesResponseType(typeof(RoleResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateRoleRequest request,
        CancellationToken cancellationToken)
    {
        if (!User.IsInRole("ADMIN"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only administrators can create system roles." });
        }

        var actorUserId = GetCurrentUserId();
        if (actorUserId == null)
        {
            return Unauthorized(new { message = "Missing or invalid access token" });
        }

        var result = await _roleService.CreateAsync(request, actorUserId.Value, cancellationToken);

        if (!result.Succeeded)
        {
            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        await _auditService.LogAsync(
            action: "CREATE_ROLE",
            entityName: "AppRole",
            entityId: result.Value?.Id.ToString(),
            description: $"Created system role '{request.Code}' ({request.Name})",
            userId: actorUserId,
            username: GetCurrentUsername(),
            ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString(),
            cancellationToken: cancellationToken);

        return StatusCode(StatusCodes.Status201Created, result.Value);
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(RoleResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] UpdateRoleRequest request,
        CancellationToken cancellationToken)
    {
        if (!User.IsInRole("ADMIN"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only administrators can update system roles." });
        }

        var actorUserId = GetCurrentUserId();
        if (actorUserId == null)
        {
            return Unauthorized(new { message = "Missing or invalid access token" });
        }

        var result = await _roleService.UpdateAsync(id, request, actorUserId.Value, cancellationToken);

        if (!result.Succeeded)
        {
            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        await _auditService.LogAsync(
            action: "UPDATE_ROLE",
            entityName: "AppRole",
            entityId: id.ToString(),
            description: $"Updated system role ID {id} ('{request.Name}')",
            userId: actorUserId,
            username: GetCurrentUsername(),
            ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString(),
            cancellationToken: cancellationToken);

        return Ok(result.Value);
    }

    [HttpGet("{id:int}/permissions")]
    [ProducesResponseType(typeof(IReadOnlyList<int>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetPermissions(int id, CancellationToken cancellationToken)
    {
        var permissionIds = await _roleService.GetRolePermissionsAsync(id, cancellationToken);
        return Ok(permissionIds);
    }

    [HttpPut("{id:int}/permissions")]
    [ProducesResponseType(typeof(RoleResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePermissions(
        int id,
        [FromBody] UpdateRolePermissionsRequest request,
        CancellationToken cancellationToken)
    {
        if (!User.IsInRole("ADMIN"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only administrators can assign role permissions." });
        }

        var actorUserId = GetCurrentUserId();
        if (actorUserId == null)
        {
            return Unauthorized(new { message = "Missing or invalid access token" });
        }

        var result = await _roleService.UpdatePermissionsAsync(id, request.PermissionIds, actorUserId.Value, cancellationToken);

        if (!result.Succeeded)
        {
            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        await _auditService.LogAsync(
            action: "UPDATE_ROLE_PERMISSIONS",
            entityName: "AppRole",
            entityId: id.ToString(),
            description: $"Updated permissions assigned to role ID {id}",
            userId: actorUserId,
            username: GetCurrentUsername(),
            ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString(),
            cancellationToken: cancellationToken);

        return Ok(result.Value);
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
}

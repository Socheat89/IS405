using System.Security.Claims;
using backend.Data;
using backend.Models.Request;
using backend.Modules.Audit.Services;
using backend.Services.Permission;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/permissions")]
public class PermissionsController : ControllerBase
{
    private readonly IPermissionService _permissionService;
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;

    public PermissionsController(
        IPermissionService permissionService,
        AppDbContext context,
        IAuditService auditService)
    {
        _permissionService = permissionService;
        _context = context;
        _auditService = auditService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<PermissionResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var permissions = await _permissionService.GetAllAsync(cancellationToken);
        return Ok(permissions);
    }

    [HttpGet("pages")]
    [Authorize("FullAuth")]
    public async Task<IActionResult> GetPages(CancellationToken cancellationToken)
    {
        var pages = await _context.Pages
            .Where(p => p.IsActive)
            .OrderBy(p => p.SortOrder)
            .Select(p => new { p.Id, p.Code, p.Name, p.ParentId })
            .ToListAsync(cancellationToken);
        return Ok(pages);
    }

    [HttpGet("me")]
    [Authorize("FullAuth")]
    [ProducesResponseType(typeof(IReadOnlyList<string>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMyPermissions(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { message = "Missing or invalid access token" });
        }

        var myPermCodes = await PermissionChecker.GetUserPermissionCodesAsync(_context, userId.Value);
        return Ok(myPermCodes);
    }


    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(PermissionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(int id, CancellationToken cancellationToken)
    {
        var permission = await _permissionService.GetByIdAsync(id, cancellationToken);
        if (permission == null)
        {
            return NotFound(new { message = "Permission was not found" });
        }

        return Ok(permission);
    }

    [HttpPost]
    [Authorize("FullAuth")]
    [ProducesResponseType(typeof(PermissionResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreatePermissionRequest request,
        CancellationToken cancellationToken)
    {
        if (!User.IsInRole("ADMIN"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only administrators can create system permissions." });
        }

        var actorUserId = GetCurrentUserId();
        if (actorUserId == null)
        {
            return Unauthorized(new { message = "Missing or invalid access token" });
        }

        var result = await _permissionService.CreateAsync(request, actorUserId.Value, cancellationToken);

        if (!result.Succeeded)
        {
            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        await _auditService.LogAsync(
            action: "CREATE_PERMISSION",
            entityName: "AppPermission",
            entityId: result.Value?.Id.ToString(),
            description: $"Created system permission '{result.Value?.Code}'",
            userId: actorUserId,
            username: GetCurrentUsername(),
            ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString(),
            cancellationToken: cancellationToken);

        return StatusCode(StatusCodes.Status201Created, result.Value);
    }

    [HttpPut("{id:int}")]
    [Authorize("FullAuth")]
    [ProducesResponseType(typeof(PermissionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] UpdatePermissionRequest request,
        CancellationToken cancellationToken)
    {
        if (!User.IsInRole("ADMIN"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only administrators can update system permissions." });
        }

        var actorUserId = GetCurrentUserId();
        if (actorUserId == null)
        {
            return Unauthorized(new { message = "Missing or invalid access token" });
        }

        var result = await _permissionService.UpdateAsync(id, request, actorUserId.Value, cancellationToken);

        if (!result.Succeeded)
        {
            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        await _auditService.LogAsync(
            action: "UPDATE_PERMISSION",
            entityName: "AppPermission",
            entityId: id.ToString(),
            description: $"Updated system permission ID {id}",
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

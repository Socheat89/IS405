using backend.Data;
using backend.Models.Data;
using backend.Models.Request;
using backend.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Permission;

public class PermissionService : IPermissionService
{
    private readonly AppDbContext _context;

    public PermissionService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<PermissionResponse>> GetAllAsync(CancellationToken cancellationToken)
    {
        return await _context.Permissions
            .Include(p => p.Page)
            .OrderBy(p => p.Id)
            .Select(p => new PermissionResponse(
                p.Id,
                p.PageId,
                p.Page.Code,
                p.Page.Name,
                p.Code,
                p.Action,
                p.Description,
                p.IsActive,
                p.CreatedAtUtc,
                p.UpdatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<PermissionResponse?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var p = await _context.Permissions
            .Include(p => p.Page)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (p == null)
        {
            return null;
        }

        return new PermissionResponse(
            p.Id,
            p.PageId,
            p.Page.Code,
            p.Page.Name,
            p.Code,
            p.Action,
            p.Description,
            p.IsActive,
            p.CreatedAtUtc,
            p.UpdatedAtUtc);
    }

    public async Task<PermissionServiceResult<PermissionResponse>> CreateAsync(
        CreatePermissionRequest request,
        int actorUserId,
        CancellationToken cancellationToken)
    {
        if (request.PageId < 1)
        {
            return PermissionServiceResult<PermissionResponse>.BadRequest("Invalid action or inactive page");
        }

        if (string.IsNullOrWhiteSpace(request.Action) || request.Action.Length > 30)
        {
            return PermissionServiceResult<PermissionResponse>.BadRequest("Invalid action or inactive page");
        }

        if (request.Description != null && request.Description.Length > 500)
        {
            return PermissionServiceResult<PermissionResponse>.BadRequest("Validation failed");
        }

        var page = await _context.Pages.FindAsync([request.PageId], cancellationToken);
        if (page == null)
        {
            return PermissionServiceResult<PermissionResponse>.NotFound("Page was not found");
        }

        if (!page.IsActive)
        {
            return PermissionServiceResult<PermissionResponse>.BadRequest("Invalid action or inactive page");
        }

        var actionClean = request.Action.Trim().ToLowerInvariant();
        var code = $"{page.Code.ToLowerInvariant()}.{actionClean}";

        var exists = await _context.Permissions
            .Where(p => p.Code.ToLower() == code || (p.PageId == request.PageId && p.Action.ToLower() == actionClean))
            .Select(p => p.Id)
            .FirstOrDefaultAsync(cancellationToken) > 0;

        if (exists)
        {
            return PermissionServiceResult<PermissionResponse>.Conflict("Permission already exists");
        }

        var permission = new AppPermission
        {
            PageId = request.PageId,
            Code = code,
            Action = actionClean,
            Description = request.Description,
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            CreatedBy = actorUserId
        };

        _context.Permissions.Add(permission);
        await _context.SaveChangesAsync(cancellationToken);

        return PermissionServiceResult<PermissionResponse>.Success(
            new PermissionResponse(
                permission.Id,
                page.Id,
                page.Code,
                page.Name,
                permission.Code,
                permission.Action,
                permission.Description,
                permission.IsActive,
                permission.CreatedAtUtc,
                permission.UpdatedAtUtc),
            statusCode: 201);
    }

    public async Task<PermissionServiceResult<PermissionResponse>> UpdateAsync(
        int id,
        UpdatePermissionRequest request,
        int actorUserId,
        CancellationToken cancellationToken)
    {
        if (request.Description != null && request.Description.Length > 500)
        {
            return PermissionServiceResult<PermissionResponse>.BadRequest("Validation failed");
        }

        var permission = await _context.Permissions
            .Include(p => p.Page)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (permission == null)
        {
            return PermissionServiceResult<PermissionResponse>.NotFound("Permission was not found");
        }

        permission.Description = request.Description;
        permission.IsActive = request.IsActive;
        permission.UpdatedAtUtc = DateTimeOffset.UtcNow;
        permission.UpdatedBy = actorUserId;

        await _context.SaveChangesAsync(cancellationToken);

        return PermissionServiceResult<PermissionResponse>.Success(
            new PermissionResponse(
                permission.Id,
                permission.PageId,
                permission.Page.Code,
                permission.Page.Name,
                permission.Code,
                permission.Action,
                permission.Description,
                permission.IsActive,
                permission.CreatedAtUtc,
                permission.UpdatedAtUtc),
            statusCode: 200);
    }
}

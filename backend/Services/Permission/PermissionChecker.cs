using System.Security.Claims;
using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Permission;

public static class PermissionChecker
{
    public static async Task<bool> IsRootAdminAsync(AppDbContext context, int userId)
    {
        return await context.UserRoles
            .Include(ur => ur.Role)
            .AnyAsync(ur => ur.UserId == userId && ur.Role != null && ur.Role.IsActive && (ur.Role.Code == "ADMIN" || ur.Role.Code == "ADMINISTRATOR"));
    }

    public static async Task<List<string>> GetUserPermissionCodesAsync(AppDbContext context, int userId)
    {
        if (await IsRootAdminAsync(context, userId))
        {
            return await context.Permissions
                .Where(p => p.IsActive)
                .Select(p => p.Code)
                .Distinct()
                .ToListAsync();
        }

        var permCodesFromDirect = await context.UserPermissions
            .Where(up => up.UserId == userId && up.Permission != null && up.Permission.IsActive)
            .Select(up => up.Permission!.Code)
            .ToListAsync();

        if (permCodesFromDirect.Count > 0)
        {
            return permCodesFromDirect.Distinct().ToList();
        }

        var roleIds = await context.UserRoles
            .Where(ur => ur.UserId == userId)
            .Include(ur => ur.Role)
            .Where(ur => ur.Role != null && ur.Role.IsActive)
            .Select(ur => ur.RoleId)
            .ToListAsync();

        var permCodesFromRoles = await context.RolePermissions
            .Where(rp => roleIds.Contains(rp.RoleId) && rp.Permission != null && rp.Permission.IsActive)
            .Select(rp => rp.Permission!.Code)
            .ToListAsync();

        return permCodesFromRoles.Distinct().ToList();
    }

    public static async Task<bool> HasPermissionAsync(AppDbContext context, int userId, params string[] requiredPermissions)
    {
        if (await IsRootAdminAsync(context, userId)) return true;

        var userPerms = await GetUserPermissionCodesAsync(context, userId);
        if (userPerms.Count == 0) return false;

        if (requiredPermissions == null || requiredPermissions.Length == 0)
        {
            return userPerms.Count > 0;
        }

        foreach (var req in requiredPermissions)
        {
            if (userPerms.Any(p => p.Equals(req, StringComparison.OrdinalIgnoreCase)))
            {
                return true;
            }
        }

        return false;
    }

    public static async Task<List<int>?> GetAllowedWarehouseIdsAsync(AppDbContext context, int userId)
    {
        if (await IsRootAdminAsync(context, userId))
        {
            return null; // null represents all warehouses (unrestricted)
        }

        var assignedIds = await context.UserWarehouses
            .Where(uw => uw.UserId == userId)
            .Select(uw => uw.WarehouseId)
            .ToListAsync();

        // If user has no specific warehouse restrictions configured, grant unrestricted access
        if (assignedIds.Count == 0)
        {
            return null;
        }

        return assignedIds;
    }

    public static async Task<bool> CanAccessWarehouseAsync(AppDbContext context, int userId, int? warehouseId)
    {
        if (!warehouseId.HasValue) return true;
        if (await IsRootAdminAsync(context, userId)) return true;

        var allowed = await GetAllowedWarehouseIdsAsync(context, userId);
        if (allowed == null) return true; // unrestricted
        return allowed.Contains(warehouseId.Value);
    }

    public static int? GetUserId(ClaimsPrincipal user)
    {
        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                   ?? user.FindFirst("sub")?.Value;

        if (int.TryParse(idClaim, out var userId))
        {
            return userId;
        }

        return null;
    }
}

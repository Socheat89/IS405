using backend.Models.Request;
using backend.Services.Common;

namespace backend.Services;

public interface IRoleService
{
    Task<RolePageResponse> GetPageAsync(
        RoleQueryRequest request,
        CancellationToken cancellationToken);

    Task<RoleResponse?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken);

    Task<RoleServiceResult<RoleResponse>> CreateAsync(
        CreateRoleRequest request,
        int actorUserId,
        CancellationToken cancellationToken);

    Task<RoleServiceResult<RoleResponse>> UpdateAsync(
        int id,
        UpdateRoleRequest request,
        int actorUserId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<int>> GetRolePermissionsAsync(
        int roleId,
        CancellationToken cancellationToken);

    Task<RoleServiceResult<RoleResponse>> UpdatePermissionsAsync(
        int roleId,
        List<int> permissionIds,
        int actorUserId,
        CancellationToken cancellationToken);
}

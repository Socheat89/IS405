using backend.Models.Request;
using backend.Services.Common;

namespace backend.Services.Permission;

public interface IPermissionService
{
    Task<IReadOnlyList<PermissionResponse>> GetAllAsync(
        CancellationToken cancellationToken);

    Task<PermissionResponse?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken);

    Task<PermissionServiceResult<PermissionResponse>> CreateAsync(
        CreatePermissionRequest request,
        int actorUserId,
        CancellationToken cancellationToken);

    Task<PermissionServiceResult<PermissionResponse>> UpdateAsync(
        int id,
        UpdatePermissionRequest request,
        int actorUserId,
        CancellationToken cancellationToken);
}

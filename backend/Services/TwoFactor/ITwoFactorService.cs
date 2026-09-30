using backend.Models.Request;
using backend.Services.Common;

namespace backend.Services.TwoFactor;

public interface ITwoFactorService
{
    Task<UserServiceResult<TwoFactorSetupResponse>> SetupTwoFactorAsync(
        int userId,
        string? ipAddress,
        CancellationToken cancellationToken);

    Task<UserServiceResult<MessageResponse>> EnableTwoFactorAsync(
        int userId,
        EnableTwoFactorRequest request,
        string? ipAddress,
        CancellationToken cancellationToken);

    Task<UserServiceResult<LoginResponse>> VerifyTwoFactorLoginAsync(
        VerifyTwoFactorRequest request,
        string? ipAddress,
        CancellationToken cancellationToken);

    Task<UserServiceResult<MessageResponse>> DisableTwoFactorAsync(
        int userId,
        EnableTwoFactorRequest request,
        string? ipAddress,
        CancellationToken cancellationToken);
}

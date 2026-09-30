using backend.Models.Request;
using backend.Services.Common;

namespace backend.Services;

public interface IUserService
{
    Task<UserServiceResult<UserResponse>> RegisterAsync(
        RegisterRequest request,
        string? ipAddress,
        CancellationToken cancellationToken);

    Task<UserServiceResult<LoginResponse>> LoginAsync(
        LoginRequest request,
        string? ipAddress,
        CancellationToken cancellationToken);

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

    Task<UserServiceResult<ValidateInvitationResponse>> ValidateInvitationAsync(
        string token,
        string email,
        CancellationToken cancellationToken);

    Task<UserServiceResult<MessageResponse>> SetPasswordAsync(
        SetPasswordRequest request,
        string? ipAddress,
        CancellationToken cancellationToken);

    Task<UserServiceResult<string>> ResendInvitationAsync(
        int userId,
        string? frontendBaseUrl,
        CancellationToken cancellationToken);
}

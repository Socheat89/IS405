namespace backend.Models.Request;

public class RegisterRequest
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class EnableTwoFactorRequest
{
    public string TwoFactorCode { get; set; } = string.Empty;
}

public class VerifyTwoFactorRequest
{
    public string ChallengeToken { get; set; } = string.Empty;
    public string TwoFactorCode { get; set; } = string.Empty;
}

public record LoginResponse(
    bool RequiresTwoFactor,
    string? AccessToken,
    string? ChallengeToken,
    DateTimeOffset? ExpiresAtUtc,
    bool RequiresSetup = false,
    string? QrCodeDataUrl = null,
    string? Secret = null);

public record UserResponse(
    int Id,
    string Username,
    string Email);

public record MessageResponse(string Message);

public class SetPasswordRequest
{
    public string Token { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string ConfirmPassword { get; set; } = string.Empty;
}

public record ValidateInvitationResponse(
    bool IsValid,
    string? Username,
    string? Email,
    string? Message);

public record TwoFactorSetupResponse(
    string Secret,
    string OtpAuthUri,
    string QrCodeDataUrl);

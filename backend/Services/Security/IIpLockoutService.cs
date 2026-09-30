namespace backend.Services.Security;

public interface IIpLockoutService
{
    /// <summary>
    /// Checks whether the given IP address is currently locked out.
    /// </summary>
    bool IsIpBlocked(string? ipAddress, out TimeSpan remainingTime, out DateTimeOffset? lockoutEndUtc);

    /// <summary>
    /// Records a failed login attempt for the given IP address.
    /// If failed attempts reach the threshold (5), the IP is locked out for 5 minutes.
    /// </summary>
    (bool IsBlocked, int CurrentFailedCount, TimeSpan? RemainingTime, DateTimeOffset? LockoutEndUtc) RecordFailedAttempt(string? ipAddress);

    /// <summary>
    /// Resets the failed attempts counter and lockout status for the given IP address upon a successful login.
    /// </summary>
    void ResetFailedAttempts(string? ipAddress);
}

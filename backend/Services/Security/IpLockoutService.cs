using System.Collections.Concurrent;

namespace backend.Services.Security;

public class IpLockoutService : IIpLockoutService
{
    public const int MaxFailedAttempts = 5;
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(5);

    private class IpAttemptRecord
    {
        public int FailedCount { get; set; }
        public DateTimeOffset? LockoutEndUtc { get; set; }
        public DateTimeOffset LastAttemptUtc { get; set; } = DateTimeOffset.UtcNow;
    }

    private readonly ConcurrentDictionary<string, IpAttemptRecord> _records = new(StringComparer.OrdinalIgnoreCase);

    public bool IsIpBlocked(string? ipAddress, out TimeSpan remainingTime, out DateTimeOffset? lockoutEndUtc)
    {
        remainingTime = TimeSpan.Zero;
        lockoutEndUtc = null;

        var key = NormalizeIp(ipAddress);
        if (string.IsNullOrEmpty(key))
        {
            return false;
        }

        if (_records.TryGetValue(key, out var record))
        {
            lock (record)
            {
                if (record.LockoutEndUtc.HasValue)
                {
                    var now = DateTimeOffset.UtcNow;
                    if (record.LockoutEndUtc.Value > now)
                    {
                        remainingTime = record.LockoutEndUtc.Value - now;
                        lockoutEndUtc = record.LockoutEndUtc.Value;
                        return true;
                    }

                    // Lockout period has elapsed, reset counter
                    record.LockoutEndUtc = null;
                    record.FailedCount = 0;
                }
            }
        }

        return false;
    }

    public (bool IsBlocked, int CurrentFailedCount, TimeSpan? RemainingTime, DateTimeOffset? LockoutEndUtc) RecordFailedAttempt(string? ipAddress)
    {
        var key = NormalizeIp(ipAddress);
        if (string.IsNullOrEmpty(key))
        {
            return (false, 0, null, null);
        }

        var record = _records.GetOrAdd(key, _ => new IpAttemptRecord());

        lock (record)
        {
            var now = DateTimeOffset.UtcNow;

            // If previously locked out and time passed, reset
            if (record.LockoutEndUtc.HasValue && record.LockoutEndUtc.Value <= now)
            {
                record.LockoutEndUtc = null;
                record.FailedCount = 0;
            }

            record.FailedCount++;
            record.LastAttemptUtc = now;

            if (record.FailedCount >= MaxFailedAttempts)
            {
                record.LockoutEndUtc = now.Add(LockoutDuration);
                return (true, record.FailedCount, LockoutDuration, record.LockoutEndUtc);
            }

            return (false, record.FailedCount, null, null);
        }
    }

    public void ResetFailedAttempts(string? ipAddress)
    {
        var key = NormalizeIp(ipAddress);
        if (!string.IsNullOrEmpty(key))
        {
            _records.TryRemove(key, out _);
        }
    }

    private static string NormalizeIp(string? ip)
    {
        if (string.IsNullOrWhiteSpace(ip)) return "127.0.0.1";
        var trimmed = ip.Trim();
        if (trimmed == "::1") return "127.0.0.1";
        return trimmed;
    }
}

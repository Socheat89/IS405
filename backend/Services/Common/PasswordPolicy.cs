using System.Text.RegularExpressions;

namespace backend.Services.Common;

public static class PasswordPolicy
{
    public const int MinLength = 8;
    public const int MaxLength = 128;

    private static readonly Regex HasUppercase = new(@"[A-Z]", RegexOptions.Compiled);
    private static readonly Regex HasLowercase = new(@"[a-z]", RegexOptions.Compiled);
    private static readonly Regex HasDigit = new(@"[0-9]", RegexOptions.Compiled);
    private static readonly Regex HasSpecialChar = new(@"[!@#$%^&*()_+\-=\[\]{};':""\\|,.<>\/?]", RegexOptions.Compiled);

    /// <summary>
    /// Validates whether the password meets the strong security policy requirements:
    /// - At least 8 characters (max 128)
    /// - At least one uppercase letter (A-Z)
    /// - At least one lowercase letter (a-z)
    /// - At least one numeric digit (0-9)
    /// - At least one special symbol (!@#$%^&*...)
    /// </summary>
    public static (bool IsValid, string? ErrorMessage) Validate(string? password)
    {
        if (string.IsNullOrEmpty(password))
        {
            return (false, "Password is required.");
        }

        if (password.Length < MinLength)
        {
            return (false, $"Password must be at least {MinLength} characters long.");
        }

        if (password.Length > MaxLength)
        {
            return (false, $"Password cannot exceed {MaxLength} characters.");
        }

        if (!HasUppercase.IsMatch(password))
        {
            return (false, "Password must contain at least one uppercase letter (A-Z).");
        }

        if (!HasLowercase.IsMatch(password))
        {
            return (false, "Password must contain at least one lowercase letter (a-z).");
        }

        if (!HasDigit.IsMatch(password))
        {
            return (false, "Password must contain at least one numeric digit (0-9).");
        }

        if (!HasSpecialChar.IsMatch(password))
        {
            return (false, "Password must contain at least one special character (e.g. !@#$%^&*).");
        }

        return (true, null);
    }
}

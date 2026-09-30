using System.Security.Claims;
using backend.Models.Data;

namespace backend.Services;

public interface ITokenService
{
    (string Token, DateTimeOffset ExpiresAt) GenerateAccessToken(AppUser user, IEnumerable<string> roles);
    (string Token, DateTimeOffset ExpiresAt) GenerateChallengeToken(AppUser user);
    int? ValidateChallengeToken(string token);
}

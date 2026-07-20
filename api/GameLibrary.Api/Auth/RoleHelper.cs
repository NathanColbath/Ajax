using System.Security.Claims;
using System.Text.Json;

namespace GameLibrary.Api.Auth;

public static class RoleHelper
{
    private static readonly Dictionary<string, int> RoleRank = new(StringComparer.Ordinal)
    {
        [Roles.Standard] = 1,
        [Roles.Admin] = 2,
        [Roles.SuperAdmin] = 3,
    };

    public static IEnumerable<string> GetRoles(ClaimsPrincipal user)
    {
        return user.FindAll(ClaimTypes.Role)
            .Concat(user.FindAll(AuthOptions.DefaultRolesClaimType))
            .Select(c => c.Value)
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Distinct(StringComparer.Ordinal);
    }

    public static string? GetHighestRole(ClaimsPrincipal user)
    {
        return GetRoles(user)
            .Where(r => RoleRank.ContainsKey(r))
            .OrderByDescending(r => RoleRank[r])
            .FirstOrDefault();
    }

    public static bool IsAtLeast(ClaimsPrincipal user, string minimumRole)
    {
        var highest = GetHighestRole(user);
        if (highest is null || !RoleRank.TryGetValue(minimumRole, out var minimumRank))
        {
            return false;
        }

        return RoleRank.TryGetValue(highest, out var currentRank) && currentRank >= minimumRank;
    }

    public static bool IsSuperAdmin(ClaimsPrincipal user) =>
        GetRoles(user).Contains(Roles.SuperAdmin, StringComparer.Ordinal);

    public static IEnumerable<string> ParseRolesClaimValue(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            yield break;
        }

        var trimmed = value.Trim();
        if (trimmed.StartsWith('[') && trimmed.EndsWith(']'))
        {
            string[]? parsed = null;
            try
            {
                parsed = JsonSerializer.Deserialize<string[]>(trimmed);
            }
            catch
            {
                // fall through to scalar parsing
            }

            if (parsed is not null)
            {
                foreach (var role in parsed.Where(r => !string.IsNullOrWhiteSpace(r)))
                {
                    yield return role.Trim();
                }

                yield break;
            }
        }

        foreach (var part in trimmed.Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            yield return part;
        }
    }
}

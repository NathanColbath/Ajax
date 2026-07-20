using System.Security.Claims;

namespace GameLibrary.Api.Auth;

public interface ICurrentUserService
{
    bool IsAuthenticated { get; }
    string? UserId { get; }
    string? DisplayName { get; }
    string? Email { get; }
    string? Role { get; }
    bool IsAtLeast(string minimumRole);
    bool IsSuperAdmin { get; }
}

public sealed class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    private ClaimsPrincipal? User => httpContextAccessor.HttpContext?.User;

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated == true;

    public string? UserId =>
        User?.FindFirstValue(AuthOptions.DefaultUserIdClaimType)
        ?? User?.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User?.FindFirstValue("sub");

    public string? DisplayName =>
        User?.FindFirstValue(ClaimTypes.Name)
        ?? User?.FindFirstValue("name")
        ?? User?.FindFirstValue("nickname");

    public string? Email =>
        User?.FindFirstValue(ClaimTypes.Email)
        ?? User?.FindFirstValue("email");

    public string? Role => User is null ? null : RoleHelper.GetHighestRole(User);

    public bool IsAtLeast(string minimumRole) =>
        User is not null && RoleHelper.IsAtLeast(User, minimumRole);

    public bool IsSuperAdmin => User is not null && RoleHelper.IsSuperAdmin(User);
}

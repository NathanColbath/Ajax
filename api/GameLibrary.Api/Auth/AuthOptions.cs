namespace GameLibrary.Api.Auth;

public class AuthOptions
{
    public const string SectionName = "Auth0";

    public const string DefaultRolesClaimType = "https://game-library/roles";
    public const string DefaultUserIdClaimType = "https://game-library/user_id";

    public string Domain { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;

    public string RolesClaimType { get; set; } = DefaultRolesClaimType;
    public string UserIdClaimType { get; set; } = DefaultUserIdClaimType;
}

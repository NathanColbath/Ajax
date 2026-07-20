namespace GameLibrary.Api.Auth;

public static class Policies
{
    public const string Authenticated = "Authenticated";
    public const string AdminOrAbove = "AdminOrAbove";
    public const string SuperAdminOnly = "SuperAdminOnly";
}

public static class Roles
{
    public const string Standard = "standard";
    public const string Admin = "admin";
    public const string SuperAdmin = "super_admin";
}

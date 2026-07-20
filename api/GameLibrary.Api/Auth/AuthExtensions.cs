using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace GameLibrary.Api.Auth;

public static class AuthExtensions
{
    public static IServiceCollection AddGameLibraryAuth(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<AuthOptions>(configuration.GetSection(AuthOptions.SectionName));
        var authOptions = configuration.GetSection(AuthOptions.SectionName).Get<AuthOptions>()
            ?? throw new InvalidOperationException("Auth0 configuration is missing.");

        if (string.IsNullOrWhiteSpace(authOptions.Domain))
        {
            throw new InvalidOperationException("Auth0:Domain is required.");
        }

        if (string.IsNullOrWhiteSpace(authOptions.Audience))
        {
            throw new InvalidOperationException("Auth0:Audience is required.");
        }

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = $"https://{authOptions.Domain.TrimEnd('/')}/";
                options.Audience = authOptions.Audience;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    NameClaimType = ClaimTypes.Name,
                    RoleClaimType = ClaimTypes.Role,
                    ValidateAudience = true,
                    ValidateIssuer = true,
                };

                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = context =>
                    {
                        if (context.Principal?.Identity is not ClaimsIdentity identity)
                        {
                            return Task.CompletedTask;
                        }

                        var rolesClaim = string.IsNullOrWhiteSpace(authOptions.RolesClaimType)
                            ? AuthOptions.DefaultRolesClaimType
                            : authOptions.RolesClaimType;
                        var roleValues = context.Principal
                            .FindAll(rolesClaim)
                            .SelectMany(c => RoleHelper.ParseRolesClaimValue(c.Value))
                            .Distinct(StringComparer.Ordinal)
                            .ToList();

                        foreach (var role in roleValues)
                        {
                            if (!identity.HasClaim(ClaimTypes.Role, role))
                            {
                                identity.AddClaim(new Claim(ClaimTypes.Role, role));
                            }
                        }

                        return Task.CompletedTask;
                    },
                };
            });

        services.AddAuthorization(options =>
        {
            options.AddPolicy(Policies.Authenticated, policy =>
                policy.RequireAuthenticatedUser());

            options.AddPolicy(Policies.AdminOrAbove, policy =>
                policy.RequireAuthenticatedUser()
                    .RequireAssertion(context => RoleHelper.IsAtLeast(context.User, Roles.Admin)));

            options.AddPolicy(Policies.SuperAdminOnly, policy =>
                policy.RequireAuthenticatedUser()
                    .RequireAssertion(context => RoleHelper.IsSuperAdmin(context.User)));
        });

        return services;
    }
}

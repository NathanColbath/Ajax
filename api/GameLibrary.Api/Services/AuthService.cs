using GameLibrary.Api.Auth;
using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Entities;
using GameLibrary.Api.Mapping;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Services;

public class AuthService(AppDbContext db, ICurrentUserService currentUser, IAppEventLogger eventLogger)
{
    public async Task<AuthSessionDto?> GetSessionAsync(CancellationToken cancellationToken = default)
    {
        if (!currentUser.IsAuthenticated)
        {
            return null;
        }

        var user = await EnsureUserAsync(cancellationToken);
        return user is null ? null : EntityMappers.ToSessionDto(user);
    }

    public async Task<AppUser?> EnsureUserAsync(CancellationToken cancellationToken = default)
    {
        var externalId = currentUser.UserId;
        if (string.IsNullOrWhiteSpace(externalId))
        {
            return null;
        }

        var email = currentUser.Email ?? $"{externalId}@unknown.local";
        var name = currentUser.DisplayName ?? email.Split('@')[0];
        var role = currentUser.Role ?? Roles.Standard;

        var user = await db.Users.FirstOrDefaultAsync(
            u => u.Id == externalId || u.Email == email,
            cancellationToken);

        if (user is null)
        {
            user = new AppUser
            {
                Id = externalId,
                Name = name,
                Email = email,
                Role = role,
                Enabled = true,
                Initials = EntityMappers.BuildInitials(name),
            };
            db.Users.Add(user);
        }
        else
        {
            user.Name = name;
            user.Email = email;
            if (!string.IsNullOrWhiteSpace(currentUser.Role))
            {
                user.Role = currentUser.Role;
            }

            if (string.IsNullOrWhiteSpace(user.Initials))
            {
                user.Initials = EntityMappers.BuildInitials(name);
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Auth",
            EventType = "UserUpserted",
            Message = $"User upserted: {user.Email}",
            EntityType = "User",
            EntityId = user.Id,
        }, cancellationToken);

        return user;
    }
}

using GameLibrary.Api.Auth;
using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Entities;
using GameLibrary.Api.Mapping;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Services;

public class UsersService(AppDbContext db, ICurrentUserService currentUser, IAppEventLogger eventLogger)
{
    public async Task<IReadOnlyList<LibraryUserDto>> ListAsync(CancellationToken cancellationToken = default)
    {
        var users = await db.Users.OrderBy(u => u.Name).ToListAsync(cancellationToken);
        return users.Select(EntityMappers.ToDto).ToList();
    }

    public async Task<LibraryUserDto?> ToggleEnabledAsync(string id, CancellationToken cancellationToken = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user is null)
        {
            return null;
        }

        user.Enabled = !user.Enabled;
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Users",
            EventType = "Toggled",
            Message = $"User {user.Email} enabled={user.Enabled}",
            EntityType = "User",
            EntityId = user.Id,
        }, cancellationToken);

        return EntityMappers.ToDto(user);
    }

    public async Task<LibraryUserDto> InviteAsync(
        InviteUserRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = new AppUser
        {
            Id = $"u{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            Name = request.Name.Trim(),
            Email = request.Email.Trim(),
            Role = request.Role,
            Enabled = true,
            Initials = EntityMappers.BuildInitials(request.Name),
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Users",
            EventType = "Created",
            Message = $"User created: {user.Email}",
            EntityType = "User",
            EntityId = user.Id,
        }, cancellationToken);

        return EntityMappers.ToDto(user);
    }

    public async Task<DeleteStatus> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user is null)
        {
            return DeleteStatus.NotFound();
        }

        if (IsSelf(user))
        {
            return DeleteStatus.Invalid("You cannot delete your own account.");
        }

        if (IsAdminRole(user.Role))
        {
            var adminCount = await db.Users.CountAsync(
                u => u.Role == Roles.Admin || u.Role == Roles.SuperAdmin,
                cancellationToken);
            if (adminCount <= 1)
            {
                return DeleteStatus.Conflicted("Cannot delete the last admin user.");
            }
        }

        var email = user.Email;
        db.Users.Remove(user);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Users",
            EventType = "Deleted",
            Message = $"User deleted: {email}",
            EntityType = "User",
            EntityId = id,
        }, cancellationToken);

        return DeleteStatus.Ok();
    }

    private bool IsSelf(AppUser user)
    {
        if (!string.IsNullOrWhiteSpace(currentUser.UserId)
            && string.Equals(currentUser.UserId, user.Id, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return !string.IsNullOrWhiteSpace(currentUser.Email)
            && string.Equals(currentUser.Email, user.Email, StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsAdminRole(string role) =>
        string.Equals(role, Roles.Admin, StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, Roles.SuperAdmin, StringComparison.OrdinalIgnoreCase);
}

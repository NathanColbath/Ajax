using GameLibrary.Api.Auth;
using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Services;

public class DashboardService(
    AppDbContext db,
    AuthService authService,
    ICurrentUserService currentUser,
    FileStorageService fileStorage)
{
    public async Task<DashboardSnapshotDto?> GetSnapshotAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        if (!currentUser.IsAtLeast(Roles.Admin) && currentUser.UserId != userId)
        {
            userId = currentUser.UserId ?? userId;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            user = await authService.EnsureUserAsync(cancellationToken);
        }

        if (user is null)
        {
            return null;
        }

        var config = await db.SystemConfig.FirstOrDefaultAsync(cancellationToken);

        var favorites = await db.UserGameStates
            .Where(s => s.UserId == user.Id && s.Favorite)
            .Include(s => s.Game)
            .Select(s => s.Game!)
            .OrderBy(g => g.Title)
            .Take(Math.Clamp(config?.DashboardFavoritesLimit ?? 6, 1, 50))
            .ToListAsync(cancellationToken);

        var recent = await db.Games
            .OrderByDescending(g => g.DownloadCount)
            .Take(Math.Clamp(config?.DashboardRecentLimit ?? 5, 1, 50))
            .ToListAsync(cancellationToken);

        var myFavorites = await db.UserGameStates.CountAsync(
            s => s.UserId == user.Id && s.Favorite,
            cancellationToken);

        var myDownloads = await db.UserGameStates.CountAsync(
            s => s.UserId == user.Id,
            cancellationToken);

        var libraryGames = await db.Games.CountAsync(cancellationToken);
        var physicalGames = await db.PhysicalItems.CountAsync(cancellationToken);
        var systems = await db.Systems.CountAsync(cancellationToken);
        var storage = fileStorage.GetUsageSnapshot();

        var missingArt = await db.Games.CountAsync(g => !g.HasArt, cancellationToken);
        var duplicateGroups = await db.DuplicateGroups.CountAsync(cancellationToken);
        var metadataQueue = await db.MetadataReviewItems.CountAsync(cancellationToken);

        var attention = new List<DashboardAttentionItemDto>();
        if (missingArt > 0)
        {
            attention.Add(new("art", "Missing artwork in library", missingArt, "warning", "/games"));
        }

        if (duplicateGroups > 0)
        {
            attention.Add(new("dupes", "Duplicate files", duplicateGroups, "danger", "/duplicates"));
        }

        if (metadataQueue > 0)
        {
            attention.Add(new("meta", "Unmatched metadata", metadataQueue, "info", "/metadata"));
        }

        return new DashboardSnapshotDto(
            user.Id,
            user.Name,
            new DashboardStatsDto(
                myFavorites,
                myDownloads,
                libraryGames,
                physicalGames,
                systems,
                storage.UsedGb,
                storage.TotalGb),
            attention,
            recent.Select(g => new DashboardRecentGameDto(g.Id, g.Title, g.System, g.Accent, g.HasArt)).ToList(),
            favorites.Select(g => new DashboardRecentGameDto(g.Id, g.Title, g.System, g.Accent, g.HasArt)).ToList());
    }
}

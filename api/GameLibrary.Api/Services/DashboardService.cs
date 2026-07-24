using GameLibrary.Api.Auth;
using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Entities;
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
        int? recommendationSeed = null,
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
        var favoritesLimit = Math.Clamp(config?.DashboardFavoritesLimit ?? 6, 1, 50);
        var shelfLimit = Math.Clamp(config?.DashboardRecentLimit ?? 6, 1, 50);

        var favorites = await db.UserGameStates
            .Where(s => s.UserId == user.Id && s.Favorite)
            .Include(s => s.Game)
            .Select(s => s.Game!)
            .Where(g => g != null && !g.IsPhysicalOnly)
            .OrderBy(g => g.Title)
            .Take(favoritesLimit)
            .ToListAsync(cancellationToken);

        var continuePlaying = await db.UserGameStates
            .AsNoTracking()
            .Where(s => s.UserId == user.Id && s.LastPlayedAt != null)
            .OrderByDescending(s => s.LastPlayedAt)
            .Select(s => s.Game!)
            .Where(g => g != null && !g.IsPhysicalOnly)
            .Take(shelfLimit)
            .ToListAsync(cancellationToken);

        var recentlyAdded = await db.Games
            .Where(g => !g.IsPhysicalOnly)
            .OrderByDescending(g => g.CreatedAt)
            .Take(shelfLimit)
            .ToListAsync(cancellationToken);

        var systemTiles = await db.Systems
            .Where(s => s.GameCount > 0)
            .OrderByDescending(s => s.GameCount)
            .ThenBy(s => s.Name)
            .Take(shelfLimit)
            .Select(s => new DashboardSystemTileDto(
                s.Id,
                s.Name,
                s.ShortName,
                s.GameCount,
                s.LogoPath != null && s.LogoPath != ""))
            .ToListAsync(cancellationToken);

        var recommendations = await BuildRecommendationsAsync(
            user.Id,
            favorites,
            shelfLimit,
            recommendationSeed,
            cancellationToken);

        var myFavorites = await db.UserGameStates.CountAsync(
            s => s.UserId == user.Id && s.Favorite,
            cancellationToken);

        var myDownloads = await db.LogEntries
            .Where(l => l.UserId == user.Id && l.EventType == "Downloaded" && l.EntityType == "Game")
            .Select(l => l.EntityId)
            .Distinct()
            .CountAsync(cancellationToken);

        var myLists = await db.UserGameLists.CountAsync(l => l.UserId == user.Id, cancellationToken);
        var libraryGames = await db.Games.CountAsync(g => !g.IsPhysicalOnly, cancellationToken);
        var physicalGames = await db.PhysicalItems.CountAsync(cancellationToken);
        var systemsCount = await db.Systems.CountAsync(cancellationToken);
        var storage = fileStorage.GetUsageSnapshot();

        var missingArt = await db.Games.CountAsync(g => !g.IsPhysicalOnly && !g.HasArt, cancellationToken);
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
                myLists,
                libraryGames,
                physicalGames,
                systemsCount,
                storage.UsedGb,
                storage.TotalGb),
            attention,
            continuePlaying.Select(ToGameDto).ToList(),
            recentlyAdded.Select(ToGameDto).ToList(),
            favorites.Select(ToGameDto).ToList(),
            systemTiles,
            recommendations.Select(ToGameDto).ToList());
    }

    public async Task<IReadOnlyList<DashboardRecentGameDto>> GetRecommendationsAsync(
        string userId,
        int? seed = null,
        CancellationToken cancellationToken = default)
    {
        if (!currentUser.IsAtLeast(Roles.Admin) && currentUser.UserId != userId)
        {
            userId = currentUser.UserId ?? userId;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? await authService.EnsureUserAsync(cancellationToken);
        if (user is null)
        {
            return [];
        }

        var config = await db.SystemConfig.FirstOrDefaultAsync(cancellationToken);
        var shelfLimit = Math.Clamp(config?.DashboardRecentLimit ?? 6, 1, 50);
        var favorites = await db.UserGameStates
            .Where(s => s.UserId == user.Id && s.Favorite)
            .Include(s => s.Game)
            .Select(s => s.Game!)
            .Where(g => g != null && !g.IsPhysicalOnly)
            .ToListAsync(cancellationToken);

        var games = await BuildRecommendationsAsync(user.Id, favorites, shelfLimit, seed, cancellationToken);
        return games.Select(ToGameDto).ToList();
    }

    private async Task<List<Game>> BuildRecommendationsAsync(
        string userId,
        List<Game> favorites,
        int limit,
        int? seed,
        CancellationToken cancellationToken)
    {
        var favoriteIds = favorites.Select(g => g.Id).ToHashSet(StringComparer.Ordinal);
        var favoriteSystems = favorites
            .Select(g => g.System)
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var favoriteGenres = favorites
            .SelectMany(g => g.Genres ?? [])
            .Where(g => !string.IsNullOrWhiteSpace(g))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var candidates = await db.Games
            .Where(g => !g.IsPhysicalOnly && !favoriteIds.Contains(g.Id))
            .OrderByDescending(g => g.DownloadCount)
            .ThenByDescending(g => g.CreatedAt)
            .Take(80)
            .ToListAsync(cancellationToken);

        var scored = candidates
            .Select(g =>
            {
                var score = g.DownloadCount;
                if (favoriteSystems.Contains(g.System))
                {
                    score += 1000;
                }

                if ((g.Genres ?? []).Any(genre => favoriteGenres.Contains(genre)))
                {
                    score += 500;
                }

                return (Game: g, Score: score);
            })
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.Game.Title, StringComparer.OrdinalIgnoreCase)
            .Select(x => x.Game)
            .ToList();

        if (seed is int s)
        {
            var rng = new Random(s);
            scored = scored.OrderBy(_ => rng.Next()).ToList();
        }

        return scored.Take(limit).ToList();
    }

    private static DashboardRecentGameDto ToGameDto(Game g) =>
        new(g.Id, g.Title, g.System, g.Accent, g.HasArt);
}

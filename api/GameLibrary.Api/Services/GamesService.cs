using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Entities;
using GameLibrary.Api.Mapping;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Services;

public class GamesService(
    AppDbContext db,
    AuthService authService,
    FileDownloadService fileDownload,
    FileStorageService fileStorage,
    ArtworkService artwork,
    IgdbRatingClient igdb,
    IAppEventLogger eventLogger)
{
    public async Task<IReadOnlyList<GameSummaryDto>> ListAsync(
        GamesQueryDto query,
        CancellationToken cancellationToken = default)
    {
        var gamesQuery = db.Games.Where(g => !g.IsPhysicalOnly);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLowerInvariant();
            gamesQuery = gamesQuery.Where(g =>
                g.Title.ToLower().Contains(search) ||
                g.System.ToLower().Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(query.System))
        {
            gamesQuery = gamesQuery.Where(g => g.System == query.System);
        }

        if (query.OwnedOnly == true)
        {
            gamesQuery = gamesQuery.Where(g => g.Owned);
        }

        var games = await gamesQuery
            .OrderBy(g => g.Title)
            .ToListAsync(cancellationToken);

        return games.Select(EntityMappers.ToSummaryDto).ToList();
    }

    public async Task<GameDetailDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var game = await db.Games
            .Include(g => g.Files)
            .FirstOrDefaultAsync(g => g.Id == id, cancellationToken);

        if (game is null)
        {
            return null;
        }

        var user = await authService.EnsureUserAsync(cancellationToken);
        UserGameState? state = null;
        GameReview? myReview = null;
        if (user is not null)
        {
            state = await db.UserGameStates
                .FirstOrDefaultAsync(s => s.UserId == user.Id && s.GameId == id, cancellationToken);
            myReview = await db.GameReviews
                .FirstOrDefaultAsync(r => r.UserId == user.Id && r.GameId == id, cancellationToken);
        }

        return EntityMappers.ToDetailDto(game, state, myReview);
    }

    public async Task<IReadOnlyList<GameReviewDto>> ListReviewsAsync(
        string gameId,
        CancellationToken cancellationToken = default)
    {
        var user = await authService.EnsureUserAsync(cancellationToken);
        var reviews = await db.GameReviews
            .AsNoTracking()
            .Include(r => r.User)
            .Where(r => r.GameId == gameId)
            .OrderByDescending(r => r.UpdatedAt)
            .Take(50)
            .ToListAsync(cancellationToken);

        return reviews.Select(r => EntityMappers.ToDto(r, user?.Id)).ToList();
    }

    public async Task<GameReviewDto?> UpsertReviewAsync(
        string gameId,
        UpsertGameReviewRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.Rating is < 1 or > 5)
        {
            throw new InvalidOperationException("Rating must be between 1 and 5.");
        }

        var game = await db.Games.FirstOrDefaultAsync(g => g.Id == gameId, cancellationToken);
        if (game is null)
        {
            return null;
        }

        var user = await authService.EnsureUserAsync(cancellationToken);
        if (user is null)
        {
            throw new InvalidOperationException("Sign in required to leave a review.");
        }

        var now = DateTimeOffset.UtcNow;
        var review = await db.GameReviews
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.UserId == user.Id && r.GameId == gameId, cancellationToken);

        if (review is null)
        {
            review = new GameReview
            {
                Id = $"rv{Guid.NewGuid():N}"[..12],
                GameId = gameId,
                UserId = user.Id,
                Rating = request.Rating,
                Body = (request.Body ?? string.Empty).Trim(),
                CreatedAt = now,
                UpdatedAt = now,
                User = user,
            };
            db.GameReviews.Add(review);
        }
        else
        {
            review.Rating = request.Rating;
            review.Body = (request.Body ?? string.Empty).Trim();
            review.UpdatedAt = now;
            review.User ??= user;
        }

        await db.SaveChangesAsync(cancellationToken);
        await RecomputeGameRatingAsync(game, cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Games",
            EventType = "ReviewUpserted",
            Message = $"Review saved for {game.Title}: {request.Rating}/5",
            EntityType = "Game",
            EntityId = gameId,
        }, cancellationToken);

        return EntityMappers.ToDto(review, user.Id);
    }

    public async Task<bool> DeleteMyReviewAsync(string gameId, CancellationToken cancellationToken = default)
    {
        var user = await authService.EnsureUserAsync(cancellationToken);
        if (user is null)
        {
            return false;
        }

        var review = await db.GameReviews
            .FirstOrDefaultAsync(r => r.UserId == user.Id && r.GameId == gameId, cancellationToken);
        if (review is null)
        {
            return false;
        }

        db.GameReviews.Remove(review);
        await db.SaveChangesAsync(cancellationToken);

        var game = await db.Games.FirstOrDefaultAsync(g => g.Id == gameId, cancellationToken);
        if (game is not null)
        {
            await RecomputeGameRatingAsync(game, cancellationToken);
        }

        return true;
    }

    public async Task<GamePublicFeedbackDto> GetPublicFeedbackAsync(
        string gameId,
        CancellationToken cancellationToken = default)
    {
        var game = await db.Games.AsNoTracking().FirstOrDefaultAsync(g => g.Id == gameId, cancellationToken);
        if (game is null)
        {
            return new GamePublicFeedbackDto(false, null, null, null, null, string.Empty, []);
        }

        var curated = await db.GameCuratedReviews
            .AsNoTracking()
            .Where(r => r.GameId == gameId)
            .OrderByDescending(r => r.CreatedAt)
            .Take(5)
            .ToListAsync(cancellationToken);

        var comments = curated
            .Select(r => new GamePublicCommentDto(
                string.IsNullOrWhiteSpace(r.Author) ? "AI curated" : r.Author,
                r.Text,
                r.CreatedAt,
                r.Url))
            .ToList();

        double? rating = game.PublicRating;
        int? ratingsCount = game.PublicRatingsCount;
        int? criticScore = game.PublicCriticScore;
        int? ratingScale = game.PublicRating is not null
            ? (game.PublicRatingScale > 0 ? game.PublicRatingScale : 100)
            : null;
        string? ratingProvider = string.IsNullOrWhiteSpace(game.PublicRatingProvider)
            ? null
            : game.PublicRatingProvider;
        var usedDeepSeekScores = rating is not null || criticScore is not null;

        if (!usedDeepSeekScores && long.TryParse(game.ExternalId, out var igdbId))
        {
            var igdbRating = await igdb.GetRatingAsync(igdbId, cancellationToken);
            if (igdbRating is not null)
            {
                rating = igdbRating.Rating;
                ratingsCount = igdbRating.RatingsCount;
                criticScore = igdbRating.CriticScore;
                if (igdbRating.Rating is not null)
                {
                    ratingScale = 100;
                    ratingProvider = "IGDB";
                }
            }
        }

        var hasComments = comments.Count > 0;
        var hasScores = rating is not null || criticScore is not null;
        if (!hasComments && !hasScores)
        {
            return new GamePublicFeedbackDto(
                false,
                null,
                null,
                null,
                null,
                "No curated reviews yet. Admins can run Public enrichment (DeepSeek) from Metadata.",
                []);
        }

        var attributionParts = new List<string>();
        if (hasComments)
        {
            attributionParts.Add("AI-curated reviews (DeepSeek)");
        }

        if (hasScores)
        {
            attributionParts.Add(
                string.Equals(ratingProvider, "IGDB", StringComparison.OrdinalIgnoreCase)
                    ? "Ratings from IGDB"
                    : "Ratings from DeepSeek enrichment");
        }

        return new GamePublicFeedbackDto(
            true,
            rating,
            ratingsCount,
            criticScore,
            comments.FirstOrDefault(c => !string.IsNullOrWhiteSpace(c.Url))?.Url,
            string.Join(" · ", attributionParts),
            comments,
            ratingScale,
            ratingProvider);
    }

    private async Task RecomputeGameRatingAsync(Game game, CancellationToken cancellationToken)
    {
        var ratings = await db.GameReviews
            .Where(r => r.GameId == game.Id)
            .Select(r => r.Rating)
            .ToListAsync(cancellationToken);

        if (ratings.Count == 0)
        {
            game.Rating = 0;
            game.RatingCount = 0;
        }
        else
        {
            game.Rating = Math.Round(ratings.Average(), 1);
            game.RatingCount = ratings.Count;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<GameDetailDto?> UpdateAsync(
        string id,
        UpdateGameRequest request,
        CancellationToken cancellationToken = default)
    {
        var game = await db.Games
            .Include(g => g.Files)
            .FirstOrDefaultAsync(g => g.Id == id, cancellationToken);

        if (game is null)
        {
            return null;
        }

        if (request.Title is not null)
        {
            game.Title = request.Title.Trim();
        }

        if (request.Region is not null)
        {
            game.Region = request.Region.Trim();
        }

        if (request.Year is not null)
        {
            game.Year = request.Year.Value;
        }

        if (request.Description is not null)
        {
            game.Description = request.Description;
        }

        if (request.Publisher is not null)
        {
            game.Publisher = request.Publisher.Trim();
        }

        if (request.Developer is not null)
        {
            game.Developer = request.Developer.Trim();
        }

        if (request.ReleaseDate is not null)
        {
            game.ReleaseDate = request.ReleaseDate.Trim();
        }

        if (request.Players is not null)
        {
            game.Players = request.Players.Trim();
        }

        if (request.Notes is not null)
        {
            game.Notes = request.Notes;
        }

        if (request.Genres is not null)
        {
            game.Genres = request.Genres.ToList();
        }

        if (request.Tags is not null)
        {
            game.Tags = request.Tags.ToList();
        }

        if (request.Languages is not null)
        {
            game.Languages = request.Languages.ToList();
        }

        game.MetadataSource = "manual";
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Games",
            EventType = "Updated",
            Message = $"Game metadata updated: {game.Title}",
            EntityType = "Game",
            EntityId = id,
        }, cancellationToken);

        return await GetByIdAsync(id, cancellationToken);
    }

    public async Task<GameDetailDto?> UploadCoverAsync(
        string id,
        IFormFile file,
        CancellationToken cancellationToken = default)
    {
        var game = await db.Games.FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (game is null)
        {
            return null;
        }

        await using var stream = file.OpenReadStream();
        var path = await artwork.SaveGameCoverAsync(id, stream, file.FileName, cancellationToken);
        game.CoverPath = path;
        game.HasArt = true;
        game.MetadataSource = "manual";
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Games",
            EventType = "CoverUploaded",
            Message = $"Cover uploaded for {game.Title}",
            EntityType = "Game",
            EntityId = id,
        }, cancellationToken);

        return await GetByIdAsync(id, cancellationToken);
    }

    public async Task<GameDetailDto?> UploadScreenshotsAsync(
        string id,
        IFormFileCollection files,
        CancellationToken cancellationToken = default)
    {
        var game = await db.Games.FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (game is null)
        {
            return null;
        }

        var paths = game.Screenshots.ToList();
        foreach (var file in files)
        {
            var index = paths.Count;
            await using var stream = file.OpenReadStream();
            var path = await artwork.SaveGameScreenshotAsync(id, index, stream, file.FileName, cancellationToken);
            paths.Add(path);
        }

        game.Screenshots = paths;
        game.MetadataSource = "manual";
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Games",
            EventType = "ScreenshotsUploaded",
            Message = $"Screenshots uploaded for {game.Title} (+{files.Count})",
            EntityType = "Game",
            EntityId = id,
        }, cancellationToken);

        return await GetByIdAsync(id, cancellationToken);
    }

    public async Task<GameDetailDto?> DeleteCoverAsync(string id, CancellationToken cancellationToken = default)
    {
        var game = await db.Games.FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (game is null)
        {
            return null;
        }

        fileStorage.TryDeleteFile(game.CoverPath);
        artwork.DeleteGameCoverThumbs(id);
        game.CoverPath = string.Empty;
        game.HasArt = false;
        await db.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(id, cancellationToken);
    }

    public async Task<GameDetailDto?> DeleteScreenshotAsync(
        string id,
        int index,
        CancellationToken cancellationToken = default)
    {
        var game = await db.Games.FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (game is null || index < 0 || index >= game.Screenshots.Count)
        {
            return null;
        }

        fileStorage.TryDeleteFile(game.Screenshots[index]);
        game.Screenshots.RemoveAt(index);
        await db.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(id, cancellationToken);
    }

    public async Task<FileStreamResult?> GetCoverAsync(
        string id,
        string? size,
        HttpResponse response,
        CancellationToken cancellationToken = default)
    {
        var game = await db.Games.FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (game is null || string.IsNullOrWhiteSpace(game.CoverPath))
        {
            return null;
        }

        if (string.Equals(size, "thumb", StringComparison.OrdinalIgnoreCase))
        {
            var thumbPath = artwork.FindGameCoverThumbPath(id);
            if (!string.IsNullOrWhiteSpace(thumbPath))
            {
                return fileDownload.OpenImage(thumbPath, response);
            }
        }

        return fileDownload.OpenImage(game.CoverPath, response);
    }

    public async Task<FileStreamResult?> GetScreenshotAsync(
        string id,
        int index,
        HttpResponse response,
        CancellationToken cancellationToken = default)
    {
        var game = await db.Games.FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (game is null || index < 0 || index >= game.Screenshots.Count)
        {
            return null;
        }

        return fileDownload.OpenImage(game.Screenshots[index], response);
    }

    public async Task<GameDetailDto?> ToggleFavoriteAsync(string id, CancellationToken cancellationToken = default)
    {
        var game = await db.Games
            .Include(g => g.Files)
            .FirstOrDefaultAsync(g => g.Id == id, cancellationToken);

        if (game is null)
        {
            return null;
        }

        var user = await authService.EnsureUserAsync(cancellationToken);
        if (user is null)
        {
            return null;
        }

        var state = await db.UserGameStates
            .FirstOrDefaultAsync(s => s.UserId == user.Id && s.GameId == id, cancellationToken);

        if (state is null)
        {
            state = new UserGameState
            {
                UserId = user.Id,
                GameId = id,
                Favorite = true,
                PlayStatus = game.Owned ? "unplayed" : "wishlist",
            };
            db.UserGameStates.Add(state);
        }
        else
        {
            state.Favorite = !state.Favorite;
        }

        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Games",
            EventType = "FavoriteToggled",
            Message = $"Favorite toggled for game {game.Title}: {state.Favorite}",
            EntityType = "Game",
            EntityId = id,
        }, cancellationToken);

        return EntityMappers.ToDetailDto(game, state);
    }

    public async Task<FileStreamResult?> DownloadFileAsync(
        string gameId,
        string fileId,
        CancellationToken cancellationToken = default)
    {
        var file = await db.GameFiles
            .FirstOrDefaultAsync(f => f.Id == fileId && f.GameId == gameId, cancellationToken);

        if (file is null || string.IsNullOrWhiteSpace(file.StoragePath))
        {
            return null;
        }

        var game = await db.Games.FirstOrDefaultAsync(g => g.Id == gameId, cancellationToken);
        if (game is not null)
        {
            game.DownloadCount++;
            await TouchLastPlayedAsync(gameId, cancellationToken);
            await SaveChangesHandlingUserGameStateConflictAsync(cancellationToken);

            await eventLogger.WriteAsync(new AppLogEvent
            {
                Category = "Games",
                EventType = "Downloaded",
                Message = $"File downloaded: {file.Name}",
                EntityType = "Game",
                EntityId = gameId,
            }, cancellationToken);
        }

        return fileDownload.OpenAttachment(file.StoragePath, file.Name);
    }

    public async Task<bool> RecordPlayAsync(string id, CancellationToken cancellationToken = default)
    {
        var exists = await db.Games.AnyAsync(g => g.Id == id, cancellationToken);
        if (!exists)
        {
            return false;
        }

        await TouchLastPlayedAsync(id, cancellationToken);
        await SaveChangesHandlingUserGameStateConflictAsync(cancellationToken);
        return true;
    }

    private async Task TouchLastPlayedAsync(string gameId, CancellationToken cancellationToken)
    {
        var user = await authService.EnsureUserAsync(cancellationToken);
        if (user is null)
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var state = await db.UserGameStates
            .FirstOrDefaultAsync(s => s.UserId == user.Id && s.GameId == gameId, cancellationToken);

        if (state is null)
        {
            state = db.UserGameStates.Local
                .FirstOrDefault(s => s.UserId == user.Id && s.GameId == gameId);
        }

        if (state is null)
        {
            var owned = await db.Games
                .Where(g => g.Id == gameId)
                .Select(g => g.Owned)
                .FirstOrDefaultAsync(cancellationToken);
            db.UserGameStates.Add(new UserGameState
            {
                UserId = user.Id,
                GameId = gameId,
                Favorite = false,
                PlayStatus = owned ? "unplayed" : "wishlist",
                LastPlayedAt = now,
            });
        }
        else
        {
            state.LastPlayedAt = now;
        }
    }

    /// <summary>
    /// Play + download can race and both try to insert the same UserGameState row.
    /// </summary>
    private async Task SaveChangesHandlingUserGameStateConflictAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException) when (HasPendingUserGameStateInserts())
        {
            foreach (var entry in db.ChangeTracker.Entries<UserGameState>()
                .Where(e => e.State == EntityState.Added)
                .ToList())
            {
                var pending = entry.Entity;
                var lastPlayed = pending.LastPlayedAt ?? DateTimeOffset.UtcNow;
                entry.State = EntityState.Detached;

                var existing = await db.UserGameStates
                    .FirstOrDefaultAsync(
                        s => s.UserId == pending.UserId && s.GameId == pending.GameId,
                        cancellationToken);
                if (existing is not null)
                {
                    existing.LastPlayedAt = lastPlayed;
                }
            }

            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private bool HasPendingUserGameStateInserts() =>
        db.ChangeTracker.Entries<UserGameState>().Any(e => e.State == EntityState.Added);

    public async Task<DeleteStatus> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var game = await db.Games
            .Include(g => g.Files)
            .FirstOrDefaultAsync(g => g.Id == id, cancellationToken);

        if (game is null)
        {
            return DeleteStatus.NotFound();
        }

        var title = game.Title;
        foreach (var file in game.Files)
        {
            fileStorage.TryDeleteFile(file.StoragePath);
        }

        db.Games.Remove(game);
        await db.SaveChangesAsync(cancellationToken);

        fileStorage.TryDeleteDirectory(fileStorage.GetLibraryDirPath(id));
        fileStorage.TryDeleteDirectory(fileStorage.GetArtworkDirPath("games", id));

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Games",
            EventType = "Deleted",
            Message = $"Game deleted: {title}",
            EntityType = "Game",
            EntityId = id,
        }, cancellationToken);

        return DeleteStatus.Ok();
    }

    public async Task<DeleteStatus> DeleteFileAsync(
        string gameId,
        string fileId,
        CancellationToken cancellationToken = default)
    {
        var file = await db.GameFiles
            .FirstOrDefaultAsync(f => f.Id == fileId && f.GameId == gameId, cancellationToken);

        if (file is null)
        {
            return DeleteStatus.NotFound();
        }

        var name = file.Name;
        fileStorage.TryDeleteFile(file.StoragePath);
        db.GameFiles.Remove(file);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Games",
            EventType = "Deleted",
            Message = $"Game file deleted: {name}",
            EntityType = "GameFile",
            EntityId = fileId,
        }, cancellationToken);

        return DeleteStatus.Ok();
    }

    public async Task<IReadOnlyList<string>> GetSystemNamesAsync(CancellationToken cancellationToken = default)
    {
        var fromGames = await db.Games
            .Where(g => !g.IsPhysicalOnly)
            .Select(g => g.System)
            .Distinct()
            .ToListAsync(cancellationToken);
        if (fromGames.Count > 0)
        {
            return fromGames.OrderBy(s => s).ToList();
        }

        return await db.Systems
            .Select(s => s.ShortName)
            .Distinct()
            .OrderBy(s => s)
            .ToListAsync(cancellationToken);
    }
}


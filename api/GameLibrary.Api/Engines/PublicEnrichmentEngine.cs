using GameLibrary.Api.Data;
using GameLibrary.Api.Entities;
using GameLibrary.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Engines;

public class PublicEnrichmentEngine(
    AppDbContext db,
    DeepSeekChatClient deepSeek,
    ArtworkService artwork,
    IHttpClientFactory httpClientFactory,
    IAppEventLogger eventLogger,
    ILogger<PublicEnrichmentEngine> logger)
{
    private const string ProviderId = "deepseek";

    private async Task<(int Batch, int Pool, int MaxShots, int MaxReviews)> GetLimitsAsync(
        CancellationToken cancellationToken)
    {
        var config = await db.SystemConfig.FirstOrDefaultAsync(cancellationToken);
        return (
            Math.Clamp(config?.EnrichmentBatchSize ?? 15, 1, 100),
            Math.Clamp(config?.EnrichmentCandidatePool ?? 200, 1, 2000),
            Math.Clamp(config?.MaxScreenshotsPerGame ?? 4, 0, 20),
            Math.Clamp(config?.MaxCuratedReviewsPerGame ?? 3, 0, 20));
    }

    public async Task RunAsync(CancellationToken cancellationToken = default)
    {
        var state = await GetOrCreateStateAsync(cancellationToken);
        state.Status = "running";
        state.LastRunLabel = "Running…";
        state.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        if (!deepSeek.HasApiKey)
        {
            logger.LogWarning("DeepSeek API key missing — public enrichment skipped.");
            state.Status = "warning";
            state.LastRunLabel = "API key missing";
            state.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        var limits = await GetLimitsAsync(cancellationToken);
        var reviewedIds = await db.GameCuratedReviews
            .Where(r => r.Provider == ProviderId)
            .Select(r => r.GameId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var reviewedSet = reviewedIds.ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Prefer games with no curated reviews yet; also fill gaps for screenshots/ratings.
        var pool = await db.Games
            .OrderBy(g => g.Title)
            .Take(limits.Pool)
            .ToListAsync(cancellationToken);

        var games = pool
            .Where(g => !reviewedSet.Contains(g.Id)
                || g.Screenshots.Count == 0
                || g.PublicRating is null)
            .OrderBy(g => reviewedSet.Contains(g.Id) ? 1 : 0)
            .ThenBy(g => g.Screenshots.Count == 0 ? 0 : 1)
            .ThenBy(g => g.PublicRating is null ? 0 : 1)
            .ThenBy(g => g.Title)
            .Take(limits.Batch)
            .ToList();

        logger.LogInformation("Public enrichment selected {Count} game(s).", games.Count);

        var enriched = 0;
        var failed = 0;
        var http = httpClientFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(30);

        foreach (var game in games)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                var result = await deepSeek.EnrichGameAsync(
                    new DeepSeekEnrichmentRequest(
                        game.Title,
                        game.System,
                        game.Year,
                        game.Publisher,
                        game.Description),
                    cancellationToken,
                    (await db.SystemConfig.FirstOrDefaultAsync(cancellationToken))?.DeepSeekTemperature);

                if (result is null)
                {
                    failed++;
                    continue;
                }

                await ApplyResultAsync(game, result, http, cancellationToken);
                enriched++;
            }
            catch (Exception ex)
            {
                failed++;
                logger.LogWarning(ex, "Public enrichment failed for game {GameId} ({Title}).", game.Id, game.Title);
            }
        }

        state = await GetOrCreateStateAsync(cancellationToken);
        if (enriched == 0 && failed > 0)
        {
            state.Status = "warning";
            state.LastRunLabel = $"Failed for {failed} game(s)";
        }
        else if (failed > 0)
        {
            state.Status = "warning";
            state.LastRunLabel = $"Enriched {enriched}, {failed} failed · {DateTimeOffset.UtcNow:g}";
        }
        else if (enriched == 0)
        {
            state.Status = "success";
            state.LastRunLabel = "No candidates · " + DateTimeOffset.UtcNow.ToString("g");
        }
        else
        {
            state.Status = "success";
            state.LastRunLabel = $"Enriched {enriched} · {DateTimeOffset.UtcNow:g}";
        }

        state.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Metadata",
            EventType = "PublicEnrichmentCompleted",
            Message = state.LastRunLabel,
            EntityType = "PublicEnrichmentState",
            EntityId = PublicEnrichmentState.DefaultId,
        }, cancellationToken);
    }

    public async Task MarkFailedAsync(string message, CancellationToken cancellationToken = default)
    {
        var state = await GetOrCreateStateAsync(cancellationToken);
        state.Status = "warning";
        state.LastRunLabel = Truncate($"Failed: {message}", 120);
        state.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task ApplyResultAsync(
        Game game,
        DeepSeekEnrichmentResult result,
        HttpClient http,
        CancellationToken cancellationToken)
    {
        var existing = await db.GameCuratedReviews
            .Where(r => r.GameId == game.Id && r.Provider == ProviderId)
            .ToListAsync(cancellationToken);
        db.GameCuratedReviews.RemoveRange(existing);

        var now = DateTimeOffset.UtcNow;
        var maxReviews = Math.Clamp(
            (await db.SystemConfig.FirstOrDefaultAsync(cancellationToken))?.MaxCuratedReviewsPerGame ?? 3,
            0,
            20);
        foreach (var review in (result.Reviews ?? []).Take(maxReviews))
        {
            var text = review.Excerpt?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(text))
            {
                continue;
            }

            var url = review.SourceUrl?.Trim() ?? string.Empty;
            if (!IsSafeHttpUrl(url))
            {
                url = string.Empty;
            }

            db.GameCuratedReviews.Add(new GameCuratedReview
            {
                Id = $"cr{Guid.NewGuid():N}"[..12],
                GameId = game.Id,
                Author = string.IsNullOrWhiteSpace(review.SourceName) ? "AI curated" : review.SourceName!.Trim(),
                Text = Truncate(text, 600),
                Url = url,
                Provider = ProviderId,
                CreatedAt = now,
            });
        }

        if (result.Rating is >= 0 and <= 100)
        {
            game.PublicRating = result.Rating;
            game.PublicRatingScale = result.RatingScale is > 0 ? result.RatingScale.Value : 100;
            game.PublicRatingsCount = result.RatingsCount;
            game.PublicCriticScore = result.CriticScore is >= 0 and <= 100 ? result.CriticScore : game.PublicCriticScore;
            game.PublicRatingProvider = "DeepSeek";
        }
        else if (result.CriticScore is >= 0 and <= 100)
        {
            game.PublicCriticScore = result.CriticScore;
            game.PublicRatingProvider = "DeepSeek";
        }

        var paths = game.Screenshots.ToList();
        var maxShots = Math.Clamp(
            (await db.SystemConfig.FirstOrDefaultAsync(cancellationToken))?.MaxScreenshotsPerGame ?? 4,
            0,
            20);
        if (paths.Count < maxShots)
        {
            var urls = (result.ScreenshotUrls ?? [])
                .Select(u => u?.Trim())
                .Where(u => IsSafeHttpUrl(u))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(maxShots - paths.Count)
                .ToList();

            foreach (var url in urls)
            {
                try
                {
                    var path = await artwork.SaveGameScreenshotFromUrlAsync(
                        game.Id,
                        paths.Count,
                        url!,
                        http,
                        cancellationToken);
                    paths.Add(path);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Screenshot download failed for {GameId} from {Url}.", game.Id, url);
                }
            }

            game.Screenshots = paths;
        }

        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Enriched game {GameId}: reviews={ReviewCount}, rating={Rating}, screenshots={ShotCount}.",
            game.Id,
            result.Reviews?.Count ?? 0,
            game.PublicRating,
            game.Screenshots.Count);
    }

    private async Task<PublicEnrichmentState> GetOrCreateStateAsync(CancellationToken cancellationToken)
    {
        var state = await db.PublicEnrichmentStates
            .FirstOrDefaultAsync(s => s.Id == PublicEnrichmentState.DefaultId, cancellationToken);
        if (state is not null)
        {
            return state;
        }

        state = new PublicEnrichmentState
        {
            Id = PublicEnrichmentState.DefaultId,
            Status = "idle",
            LastRunLabel = "Never",
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.PublicEnrichmentStates.Add(state);
        await db.SaveChangesAsync(cancellationToken);
        return state;
    }

    private static bool IsSafeHttpUrl(string? url) =>
        !string.IsNullOrWhiteSpace(url)
        && Uri.TryCreate(url, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..(max - 1)] + "…";
}

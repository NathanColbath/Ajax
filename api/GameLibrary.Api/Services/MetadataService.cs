using System.Text.Json;
using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Engines;
using GameLibrary.Api.Jobs;
using GameLibrary.Api.Mapping;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Services;

public class MetadataService(
    AppDbContext db,
    IBackgroundJobQueue jobQueue,
    ArtworkService artwork,
    IHttpClientFactory httpClientFactory,
    IAppEventLogger eventLogger,
    ILogger<MetadataService> logger)
{
    private static readonly HashSet<string> ActiveStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "queued", "running", "processing",
    };

    public async Task<IReadOnlyList<MetadataProviderDto>> ListProvidersAsync(
        CancellationToken cancellationToken = default)
    {
        var providers = await db.MetadataProviders.OrderBy(p => p.Name).ToListAsync(cancellationToken);
        return providers.Select(EntityMappers.ToDto).ToList();
    }

    public async Task<IReadOnlyList<MetadataReviewItemDto>> ListQueueAsync(
        CancellationToken cancellationToken = default)
    {
        var items = await db.MetadataReviewItems.OrderByDescending(i => i.Id).ToListAsync(cancellationToken);
        logger.LogDebug("Metadata review queue listed: {Count} item(s).", items.Count);
        return items.Select(EntityMappers.ToDto).ToList();
    }

    public async Task<IReadOnlyList<MetadataProviderDto>> RunProviderAsync(
        string id,
        CancellationToken cancellationToken = default)
    {
        var provider = await db.MetadataProviders.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (provider is null)
        {
            logger.LogWarning("Run requested for unknown metadata provider {ProviderId}.", id);
            return await ListProvidersAsync(cancellationToken);
        }

        provider.Status = "running";
        provider.LastRunLabel = "Running…";
        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Enqueueing metadata background job for provider {ProviderId} ({Name}).",
            provider.Id,
            provider.Name);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Metadata",
            EventType = "ProviderRun",
            Message = $"Metadata provider run started: {provider.Name}",
            EntityType = "MetadataProvider",
            EntityId = provider.Id,
        }, cancellationToken);

        var providerId = provider.Id;
        await jobQueue.QueueBackgroundWorkItemAsync(new BackgroundWorkItem
        {
            JobType = "metadata",
            Work = async (sp, ct) =>
            {
                var engine = sp.GetRequiredService<MetadataMatchEngine>();
                try
                {
                    await engine.RunProviderAsync(providerId, ct);
                }
                catch (Exception ex)
                {
                    sp.GetRequiredService<ILogger<MetadataService>>()
                        .LogError(ex, "Metadata job failed for provider {ProviderId}.", providerId);
                    await engine.MarkProviderFailedAsync(providerId, ex.Message, ct);
                    throw;
                }
            },
        }, cancellationToken);

        return await ListProvidersAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<MetadataReviewItemDto>> AcceptAsync(
        string id,
        CancellationToken cancellationToken = default)
    {
        var item = await db.MetadataReviewItems.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (item is null)
        {
            return await ListQueueAsync(cancellationToken);
        }

        logger.LogInformation(
            "Accepting metadata review {ReviewId} for game {GameId}: {Title}.",
            item.Id,
            item.GameId,
            item.SuggestedTitle);

        if (!string.IsNullOrWhiteSpace(item.GameId))
        {
            var game = await db.Games.FirstOrDefaultAsync(g => g.Id == item.GameId, cancellationToken);
            if (game is not null)
            {
                await ApplyMatchAsync(game, item, cancellationToken);
            }
            else
            {
                logger.LogWarning("Accept {ReviewId}: game {GameId} not found.", item.Id, item.GameId);
            }
        }

        db.MetadataReviewItems.Remove(item);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Metadata",
            EventType = "Accept",
            Message = $"Metadata match accepted: {item.SuggestedTitle}",
            EntityType = "MetadataReviewItem",
            EntityId = item.Id,
        }, cancellationToken);

        return await ListQueueAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<MetadataReviewItemDto>> AcceptAllAsync(
        CancellationToken cancellationToken = default)
    {
        var items = await db.MetadataReviewItems
            .OrderByDescending(i => i.Id)
            .ToListAsync(cancellationToken);

        if (items.Count == 0)
        {
            return await ListQueueAsync(cancellationToken);
        }

        logger.LogInformation("Accepting all {Count} metadata review item(s).", items.Count);

        var index = 0;
        foreach (var item in items)
        {
            if (!string.IsNullOrWhiteSpace(item.GameId))
            {
                var game = await db.Games.FirstOrDefaultAsync(g => g.Id == item.GameId, cancellationToken);
                if (game is not null)
                {
                    await ApplyMatchAsync(game, item, cancellationToken);
                }
                else
                {
                    logger.LogWarning("Accept-all {ReviewId}: game {GameId} not found.", item.Id, item.GameId);
                }
            }

            db.MetadataReviewItems.Remove(item);
            index++;

            // Pace bulk applies so cover CDNs are less likely to return 429.
            if (index < items.Count)
            {
                await Task.Delay(350, cancellationToken);
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Metadata",
            EventType = "AcceptAll",
            Message = $"Accepted {items.Count} metadata match(es)",
            EntityType = "MetadataReviewItem",
        }, cancellationToken);

        return await ListQueueAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<MetadataReviewItemDto>> SkipAsync(
        string id,
        CancellationToken cancellationToken = default)
    {
        var item = await db.MetadataReviewItems.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (item is not null)
        {
            logger.LogInformation("Skipping metadata review {ReviewId} ({FileName}).", item.Id, item.FileName);
            db.MetadataReviewItems.Remove(item);
            await db.SaveChangesAsync(cancellationToken);

            await eventLogger.WriteAsync(new AppLogEvent
            {
                Category = "Metadata",
                EventType = "Skip",
                Message = $"Metadata match skipped: {item.FileName}",
                EntityType = "MetadataReviewItem",
                EntityId = item.Id,
            }, cancellationToken);
        }

        return await ListQueueAsync(cancellationToken);
    }

    public async Task<int> RecoverActiveProvidersAsync(CancellationToken cancellationToken = default)
    {
        var providers = await db.MetadataProviders
            .Where(p => ActiveStatuses.Contains(p.Status))
            .ToListAsync(cancellationToken);

        logger.LogInformation("Recovering {Count} interrupted metadata provider job(s).", providers.Count);

        foreach (var provider in providers)
        {
            var providerId = provider.Id;
            logger.LogInformation(
                "Re-enqueueing interrupted metadata provider {ProviderId} (was {Status}).",
                providerId,
                provider.Status);

            await jobQueue.QueueBackgroundWorkItemAsync(new BackgroundWorkItem
            {
                JobType = "metadata",
                Work = async (sp, ct) =>
                {
                    var engine = sp.GetRequiredService<MetadataMatchEngine>();
                    try
                    {
                        await engine.RunProviderAsync(providerId, ct);
                    }
                    catch (Exception ex)
                    {
                        await engine.MarkProviderFailedAsync(providerId, ex.Message, ct);
                        throw;
                    }
                },
            }, cancellationToken);
        }

        return providers.Count;
    }

    private async Task ApplyMatchAsync(
        Entities.Game game,
        Entities.MetadataReviewItem item,
        CancellationToken cancellationToken)
    {
        var protectManual = string.Equals(game.MetadataSource, "manual", StringComparison.OrdinalIgnoreCase);
        var screenshotUrls = new List<string>();

        if (!string.IsNullOrWhiteSpace(item.SuggestedFieldsJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(item.SuggestedFieldsJson);
                var root = doc.RootElement;

                ApplyStringField(root, "title", value =>
                {
                    if (!protectManual || string.IsNullOrWhiteSpace(game.Title))
                    {
                        game.Title = value;
                    }
                });

                ApplyStringField(root, "description", value =>
                {
                    if (!protectManual || string.IsNullOrWhiteSpace(game.Description))
                    {
                        game.Description = value;
                    }
                });

                ApplyStringField(root, "releaseDate", value =>
                {
                    if (!protectManual || string.IsNullOrWhiteSpace(game.ReleaseDate))
                    {
                        game.ReleaseDate = value;
                    }
                });

                ApplyStringField(root, "publisher", value =>
                {
                    if (!protectManual || string.IsNullOrWhiteSpace(game.Publisher))
                    {
                        game.Publisher = value;
                    }
                });

                ApplyStringField(root, "developer", value =>
                {
                    if (!protectManual || string.IsNullOrWhiteSpace(game.Developer))
                    {
                        game.Developer = value;
                    }
                });

                if (root.TryGetProperty("year", out var yearProp)
                    && yearProp.ValueKind == JsonValueKind.Number
                    && yearProp.TryGetInt32(out var year)
                    && (!protectManual || game.Year == 0))
                {
                    game.Year = year;
                }

                if (root.TryGetProperty("genres", out var genresProp)
                    && genresProp.ValueKind == JsonValueKind.Array
                    && (!protectManual || game.Genres.Count == 0))
                {
                    game.Genres = genresProp.EnumerateArray()
                        .Select(e => e.GetString())
                        .Where(s => !string.IsNullOrWhiteSpace(s))
                        .Select(s => s!.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();
                }

                ApplyStringField(root, "igdbId", value =>
                {
                    if (string.IsNullOrWhiteSpace(game.ExternalId))
                    {
                        game.ExternalId = value;
                    }
                });

                if (root.TryGetProperty("screenshots", out var shotsProp)
                    && shotsProp.ValueKind == JsonValueKind.Array
                    && game.Screenshots.Count == 0)
                {
                    screenshotUrls = shotsProp.EnumerateArray()
                        .Select(e => e.GetString())
                        .Where(s => !string.IsNullOrWhiteSpace(s))
                        .Select(s => s!.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .Take(4)
                        .ToList();
                }
            }
            catch (JsonException ex)
            {
                logger.LogWarning(ex, "Malformed SuggestedFieldsJson on review {ReviewId}.", item.Id);
            }
        }

        var http = httpClientFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(30);

        if (!string.IsNullOrWhiteSpace(item.SuggestedCoverUrl)
            && (!protectManual || string.IsNullOrWhiteSpace(game.CoverPath)))
        {
            try
            {
                logger.LogInformation(
                    "Downloading cover for game {GameId} from {Url}.",
                    game.Id,
                    item.SuggestedCoverUrl);
                var path = await artwork.SaveGameCoverFromUrlAsync(
                    game.Id,
                    item.SuggestedCoverUrl,
                    http,
                    cancellationToken);
                game.CoverPath = path;
                game.HasArt = true;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to download cover for game {GameId}; accepting metadata without art.", game.Id);
            }
        }

        if (screenshotUrls.Count > 0)
        {
            var paths = game.Screenshots.ToList();
            foreach (var url in screenshotUrls)
            {
                try
                {
                    var index = paths.Count;
                    logger.LogInformation(
                        "Downloading screenshot {Index} for game {GameId} from {Url}.",
                        index,
                        game.Id,
                        url);
                    var path = await artwork.SaveGameScreenshotFromUrlAsync(
                        game.Id,
                        index,
                        url,
                        http,
                        cancellationToken);
                    paths.Add(path);
                    // Brief pause between image fetches during bulk Accept.
                    await Task.Delay(150, cancellationToken);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to download screenshot for game {GameId}.", game.Id);
                }
            }

            game.Screenshots = paths;
        }

        game.MetadataSource = string.IsNullOrWhiteSpace(item.ProviderId) ? "hasheous" : item.ProviderId;
        if (string.IsNullOrWhiteSpace(game.ExternalId))
        {
            game.ExternalId = item.SuggestedTitle;
        }
    }

    private static void ApplyStringField(JsonElement root, string propertyName, Action<string> apply)
    {
        if (!root.TryGetProperty(propertyName, out var prop) || prop.ValueKind != JsonValueKind.String)
        {
            return;
        }

        var value = prop.GetString();
        if (!string.IsNullOrWhiteSpace(value))
        {
            apply(value.Trim());
        }
    }
}

using System.Text.Json;
using GameLibrary.Api.Data;
using GameLibrary.Api.Entities;
using GameLibrary.Api.Services;
using HasheousClient.Models;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Engines;

public class MetadataMatchEngine(
    AppDbContext db,
    HasheousMetadataClient hasheous,
    IAppEventLogger eventLogger,
    ILogger<MetadataMatchEngine> logger)
{
    private const string HasheousProviderId = "hasheous";

    private async Task<int> GetBatchSizeAsync(CancellationToken cancellationToken)
    {
        var config = await db.SystemConfig.FirstOrDefaultAsync(cancellationToken);
        return Math.Clamp(config?.HasheousBatchSize ?? 25, 1, 200);
    }

    public Task<IReadOnlyList<MetadataReviewItem>> CreateStubReviewItemsAsync(
        string providerId,
        CancellationToken cancellationToken = default) =>
        RunProviderAsync(providerId, cancellationToken);

    public async Task<IReadOnlyList<MetadataReviewItem>> RunProviderAsync(
        string providerId,
        CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Metadata provider run starting: {ProviderId}.", providerId);

        var provider = await db.MetadataProviders.FirstOrDefaultAsync(p => p.Id == providerId, cancellationToken);
        if (provider is null)
        {
            logger.LogWarning("Metadata provider not found: {ProviderId}.", providerId);
            return [];
        }

        if (string.Equals(providerId, "manual", StringComparison.OrdinalIgnoreCase))
        {
            provider.LastRunLabel = "Always on";
            provider.Status = "idle";
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Manual provider skipped (always on).");
            return [];
        }

        if (!string.Equals(providerId, HasheousProviderId, StringComparison.OrdinalIgnoreCase))
        {
            provider.LastRunLabel = "Unsupported";
            provider.Status = "warning";
            await db.SaveChangesAsync(cancellationToken);
            logger.LogWarning("Unsupported metadata provider: {ProviderId}.", providerId);
            return [];
        }

        if (!hasheous.HasApiKey)
        {
            // Hash lookup still works, but proxy enrichment needs a key — warn and continue with name-only matches.
            provider.Status = "warning";
            provider.LastRunLabel = "API key missing — hash-only matches";
            logger.LogWarning("Hasheous API key missing — continuing with hash-only matches.");
        }
        else
        {
            logger.LogInformation("Hasheous API key present — IGDB enrichment enabled.");
        }

        var totalGames = await db.Games.CountAsync(cancellationToken);
        var gamesWithFiles = await db.Games.CountAsync(g => g.Files.Any(), cancellationToken);
        var alreadyMatched = await db.Games.CountAsync(
            g => g.HasArt && !string.IsNullOrEmpty(g.MetadataSource),
            cancellationToken);
        var pendingReview = await db.MetadataReviewItems.CountAsync(
            i => i.ProviderId == providerId,
            cancellationToken);

        logger.LogInformation(
            "Metadata pool: totalGames={Total}, withFiles={WithFiles}, alreadyMatched={Matched}, pendingReview={Pending}.",
            totalGames,
            gamesWithFiles,
            alreadyMatched,
            pendingReview);

        var games = await db.Games
            .Include(g => g.Files)
            .Where(g =>
                (!g.HasArt || string.IsNullOrEmpty(g.MetadataSource)) &&
                g.Files.Any(f =>
                    (f.Md5Hash != null && f.Md5Hash != "") ||
                    (f.Sha1Hash != null && f.Sha1Hash != "") ||
                    (f.ContentHash != null && f.ContentHash != "") ||
                    (f.StoragePath != null && f.StoragePath != "")))
            .OrderBy(g => g.Title)
            .Take(await GetBatchSizeAsync(cancellationToken))
            .ToListAsync(cancellationToken);

        logger.LogInformation(
            "Selected {CandidateCount} candidate game(s) for Hasheous matching (batchSize={BatchSize}).",
            games.Count,
            await GetBatchSizeAsync(cancellationToken));

        var created = new List<MetadataReviewItem>();
        var skippedAlreadyQueued = 0;
        var skippedNoHash = 0;
        var missedLookup = 0;

        foreach (var game in games)
        {
            var outcome = await TryMatchGameAsync(provider.Id, game, cancellationToken);
            switch (outcome.Status)
            {
                case MatchAttemptStatus.Created when outcome.Item is not null:
                    created.Add(outcome.Item);
                    break;
                case MatchAttemptStatus.AlreadyQueued:
                    skippedAlreadyQueued++;
                    break;
                case MatchAttemptStatus.NoHash:
                    skippedNoHash++;
                    break;
                case MatchAttemptStatus.LookupMiss:
                    missedLookup++;
                    break;
            }
        }

        if (hasheous.HasApiKey)
        {
            provider.LastRunLabel = "Just now";
            provider.Status = created.Count > 0 ? "success" : "idle";
        }
        else if (created.Count > 0)
        {
            provider.LastRunLabel = "Just now (hash-only, no API key)";
            provider.Status = "warning";
        }
        else
        {
            provider.LastRunLabel = "Just now (no matches)";
            provider.Status = "idle";
        }

        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Metadata provider run finished: created={Created}, alreadyQueued={Queued}, noHash={NoHash}, lookupMiss={Miss}, status={Status}.",
            created.Count,
            skippedAlreadyQueued,
            skippedNoHash,
            missedLookup,
            provider.Status);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Metadata",
            EventType = "Completed",
            Message =
                $"Metadata provider run completed: {provider.Name} ({created.Count} items; miss={missedLookup}, noHash={skippedNoHash}, queued={skippedAlreadyQueued})",
            EntityType = "MetadataProvider",
            EntityId = provider.Id,
        }, cancellationToken);

        return created;
    }

    public async Task MarkProviderFailedAsync(
        string providerId,
        string errorMessage,
        CancellationToken cancellationToken = default)
    {
        var provider = await db.MetadataProviders.FirstOrDefaultAsync(p => p.Id == providerId, cancellationToken);
        if (provider is null)
        {
            return;
        }

        provider.Status = "warning";
        provider.LastRunLabel = TruncateLabel($"Failed: {errorMessage}");
        await db.SaveChangesAsync(cancellationToken);
        logger.LogWarning("Metadata provider {ProviderId} marked failed: {Error}.", providerId, errorMessage);
    }

    public async Task<MetadataReviewItem?> MatchSingleGameAsync(
        string gameId,
        CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Single-game metadata match starting for {GameId}.", gameId);

        var provider = await db.MetadataProviders.FirstOrDefaultAsync(p => p.Id == HasheousProviderId, cancellationToken);
        if (provider is null || !provider.Enabled)
        {
            logger.LogWarning("Hasheous provider missing or disabled; skipping single match for {GameId}.", gameId);
            return null;
        }

        var game = await db.Games
            .Include(g => g.Files)
            .FirstOrDefaultAsync(g => g.Id == gameId, cancellationToken);
        if (game is null)
        {
            logger.LogWarning("Game {GameId} not found for metadata match.", gameId);
            return null;
        }

        logger.LogInformation(
            "Single-game match context: title={Title}, files={FileCount}, hasArt={HasArt}, source={Source}.",
            game.Title,
            game.Files.Count,
            game.HasArt,
            game.MetadataSource ?? "(none)");

        var outcome = await TryMatchGameAsync(provider.Id, game, cancellationToken);
        logger.LogInformation(
            "Single-game match for {GameId} finished with status={Status}.",
            gameId,
            outcome.Status);
        return outcome.Item;
    }

    private async Task<MatchAttemptResult> TryMatchGameAsync(
        string providerId,
        Game game,
        CancellationToken cancellationToken)
    {
        var alreadyQueued = await db.MetadataReviewItems
            .AnyAsync(i => i.GameId == game.Id && i.ProviderId == providerId, cancellationToken);
        if (alreadyQueued)
        {
            logger.LogInformation("Skip {GameId} ({Title}): already in review queue.", game.Id, game.Title);
            return MatchAttemptResult.AlreadyQueued();
        }

        var file = game.Files
            .OrderByDescending(f => !string.IsNullOrWhiteSpace(f.Md5Hash))
            .ThenByDescending(f => !string.IsNullOrWhiteSpace(f.Sha1Hash))
            .FirstOrDefault();
        if (file is null)
        {
            logger.LogInformation("Skip {GameId} ({Title}): no files.", game.Id, game.Title);
            return MatchAttemptResult.NoHash();
        }

        await EnsureFileHashesAsync(file, cancellationToken);

        if (string.IsNullOrWhiteSpace(file.Md5Hash)
            && string.IsNullOrWhiteSpace(file.Sha1Hash)
            && string.IsNullOrWhiteSpace(file.ContentHash))
        {
            logger.LogInformation(
                "Skip {GameId} ({Title}): no usable hashes (file={FileName}, path={HasPath}).",
                game.Id,
                game.Title,
                file.Name,
                !string.IsNullOrWhiteSpace(file.StoragePath));
            return MatchAttemptResult.NoHash();
        }

        logger.LogInformation(
            "Looking up {GameId} ({Title}) file={FileName} md5={Md5} sha1={Sha1Prefix}… sha256={Sha256Prefix}…",
            game.Id,
            game.Title,
            file.Name,
            file.Md5Hash ?? "(none)",
            string.IsNullOrWhiteSpace(file.Sha1Hash) ? "(none)" : file.Sha1Hash[..Math.Min(12, file.Sha1Hash.Length)],
            string.IsNullOrWhiteSpace(file.ContentHash) ? "(none)" : file.ContentHash[..Math.Min(12, file.ContentHash.Length)]);

        var lookup = await hasheous.LookupAsync(file.Md5Hash, file.Sha1Hash, file.ContentHash, cancellationToken);
        if (lookup is null || (string.IsNullOrWhiteSpace(lookup.Name) && (lookup.Metadata is null || lookup.Metadata.Count == 0)))
        {
            logger.LogInformation("No Hasheous match for {GameId} ({Title}).", game.Id, game.Title);
            return MatchAttemptResult.LookupMiss();
        }

        var igdbMap = lookup.Metadata?
            .FirstOrDefault(m =>
                string.Equals(m.Source, "IGDB", StringComparison.OrdinalIgnoreCase)
                && !string.IsNullOrWhiteSpace(m.Id));

        logger.LogInformation(
            "Hasheous match for {GameId}: name={Name}, igdbId={IgdbId}, matchMethod={Method}, attributes={AttrCount}.",
            game.Id,
            lookup.Name ?? "(none)",
            igdbMap?.Id ?? "(none)",
            igdbMap?.MatchMethod?.ToString() ?? "(none)",
            lookup.Attributes?.Count ?? 0);

        var suggestedTitle = !string.IsNullOrWhiteSpace(lookup.Name) ? lookup.Name! : game.Title;
        var confidence = ResolveConfidence(igdbMap?.MatchMethod, enriched: false);
        string? coverUrl = null;
        string? description = null;
        string? publisher = lookup.Publisher?.Name;
        string? developer = null;
        int? year = null;
        string? releaseDate = null;
        var genres = new List<string>();
        string? externalId = igdbMap?.Id;
        string? slug = null;
        var screenshots = new List<string>();

        // Prefer fields already present on the hash lookup — no MetadataProxy / API key required.
        ApplyLookupAttributes(
            lookup,
            ref coverUrl,
            ref description,
            ref publisher,
            ref year,
            genres,
            screenshots);

        var attributeEnriched = !string.IsNullOrWhiteSpace(coverUrl)
            || !string.IsNullOrWhiteSpace(description)
            || genres.Count > 0
            || year is not null;

        if (attributeEnriched)
        {
            confidence = Math.Max(confidence, ResolveConfidence(igdbMap?.MatchMethod, enriched: true) - 0.05);
            logger.LogInformation(
                "Attribute enrichment for {GameId}: cover={HasCover}, description={HasDesc}, year={Year}, genres={GenreCount}, publisher={Publisher}.",
                game.Id,
                !string.IsNullOrWhiteSpace(coverUrl),
                !string.IsNullOrWhiteSpace(description),
                year?.ToString() ?? "(none)",
                genres.Count,
                publisher ?? "(none)");
        }

        if (igdbMap is not null && hasheous.HasApiKey)
        {
            HasheousClient.Models.Metadata.IGDB.Game? igdbGame = null;
            if (long.TryParse(igdbMap.Id, out var igdbId))
            {
                igdbGame = await hasheous.GetIgdbGameAsync(igdbId, cancellationToken);
            }
            else
            {
                logger.LogWarning("IGDB id '{IgdbId}' is not numeric for game {GameId}.", igdbMap.Id, game.Id);
            }

            if (igdbGame is not null)
            {
                if (!string.IsNullOrWhiteSpace(igdbGame.Name))
                {
                    suggestedTitle = igdbGame.Name;
                }

                if (string.IsNullOrWhiteSpace(description))
                {
                    description = !string.IsNullOrWhiteSpace(igdbGame.Summary)
                        ? igdbGame.Summary
                        : igdbGame.Storyline;
                }

                if (igdbGame.FirstReleaseDate is DateTimeOffset release)
                {
                    releaseDate ??= release.UtcDateTime.ToString("yyyy-MM-dd");
                    year ??= release.UtcDateTime.Year;
                }

                if (genres.Count == 0)
                {
                    genres.AddRange(await ResolveGenreNamesAsync(igdbGame.Genres, cancellationToken));
                }

                if (string.IsNullOrWhiteSpace(coverUrl) && igdbGame.Cover > 0)
                {
                    var cover = await hasheous.GetIgdbCoverAsync(igdbGame.Cover, cancellationToken);
                    coverUrl = HasheousMetadataClient.BuildCoverUrl(cover);
                    logger.LogInformation("IGDB cover URL for {GameId}: {CoverUrl}", game.Id, coverUrl ?? "(none)");
                }

                externalId = igdbGame.Id?.ToString() ?? igdbMap.Id;
                slug = igdbGame.Slug;
                confidence = ResolveConfidence(igdbMap.MatchMethod, enriched: true);
            }
            else
            {
                logger.LogWarning(
                    "IGDB MetadataProxy failed for game {GameId} igdbId={IgdbId}; using Hasheous attributes only.",
                    game.Id,
                    igdbMap.Id);
            }
        }
        else if (igdbMap is not null && !hasheous.HasApiKey)
        {
            logger.LogInformation("Skipping IGDB proxy for {GameId} — no API key (attributes still applied).", game.Id);
        }

        var fieldsPayload = new
        {
            title = suggestedTitle,
            description,
            year,
            releaseDate,
            publisher,
            developer,
            genres,
            igdbId = externalId,
            slug,
            screenshots,
            hasheousId = lookup.Id,
            platform = lookup.Platform?.Name,
        };

        var fileName = file.Name;
        if (string.IsNullOrWhiteSpace(fileName))
        {
            fileName = $"{suggestedTitle}.bin";
        }

        var item = new MetadataReviewItem
        {
            Id = $"m{Guid.NewGuid():N}"[..10],
            FileName = fileName,
            SuggestedTitle = suggestedTitle,
            System = game.System,
            Confidence = confidence,
            GameId = game.Id,
            ProviderId = providerId,
            SuggestedCoverUrl = coverUrl ?? string.Empty,
            SuggestedFieldsJson = JsonSerializer.Serialize(fieldsPayload),
        };

        db.MetadataReviewItems.Add(item);
        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Queued review {ReviewId} for {GameId}: title={Title}, confidence={Confidence:0.00}, cover={HasCover}.",
            item.Id,
            game.Id,
            item.SuggestedTitle,
            item.Confidence,
            !string.IsNullOrWhiteSpace(item.SuggestedCoverUrl));

        return MatchAttemptResult.Created(item);
    }

    private void ApplyLookupAttributes(
        LookupItemModel lookup,
        ref string? coverUrl,
        ref string? description,
        ref string? publisher,
        ref int? year,
        List<string> genres,
        List<string> screenshots)
    {
        if (lookup.Attributes is null || lookup.Attributes.Count == 0)
        {
            return;
        }

        foreach (var attr in lookup.Attributes)
        {
            switch (attr.attributeName)
            {
                case AttributeItem.AttributeName.Logo when string.IsNullOrWhiteSpace(coverUrl):
                    coverUrl = BuildHasheousImageUrl(attr.Link, attr.Value?.ToString());
                    break;

                case AttributeItem.AttributeName.Screenshot1:
                case AttributeItem.AttributeName.Screenshot2:
                case AttributeItem.AttributeName.Screenshot3:
                case AttributeItem.AttributeName.Screenshot4:
                    var shot = BuildHasheousImageUrl(attr.Link, attr.Value?.ToString());
                    if (!string.IsNullOrWhiteSpace(shot))
                    {
                        screenshots.Add(shot);
                    }

                    break;

                case AttributeItem.AttributeName.AIDescription:
                case AttributeItem.AttributeName.Description:
                    if (string.IsNullOrWhiteSpace(description))
                    {
                        description = CleanDescription(attr.Value?.ToString());
                    }

                    break;

                case AttributeItem.AttributeName.Publisher when string.IsNullOrWhiteSpace(publisher):
                    publisher = attr.Value?.ToString()?.Trim();
                    break;

                case AttributeItem.AttributeName.Year when year is null:
                    year = ParseYear(attr.Value?.ToString());
                    break;

                case AttributeItem.AttributeName.Tags when genres.Count == 0:
                    genres.AddRange(ExtractGenreTags(attr.Value));
                    break;
            }
        }

        // If we have screenshots but no logo, use the first screenshot as cover.
        if (string.IsNullOrWhiteSpace(coverUrl) && screenshots.Count > 0)
        {
            coverUrl = screenshots[0];
        }
    }

    private static string? BuildHasheousImageUrl(string? link, string? imageId)
    {
        if (!string.IsNullOrWhiteSpace(link))
        {
            if (link.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                || link.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                return link;
            }

            return "https://hasheous.org" + (link.StartsWith('/') ? link : "/" + link);
        }

        if (!string.IsNullOrWhiteSpace(imageId))
        {
            return $"https://hasheous.org/api/v1/images/{imageId.Trim()}";
        }

        return null;
    }

    private static string? CleanDescription(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var text = raw.Trim();
        // Strip a leading markdown heading line from AI descriptions.
        if (text.StartsWith('#'))
        {
            var newline = text.IndexOf('\n');
            if (newline > 0 && newline < text.Length - 1)
            {
                text = text[(newline + 1)..].Trim();
            }
        }

        return text;
    }

    private static int? ParseYear(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        if (int.TryParse(raw.Trim(), out var year) && year is >= 1970 and <= 2100)
        {
            return year;
        }

        if (DateTime.TryParse(raw, out var date) && date.Year is >= 1970 and <= 2100)
        {
            return date.Year;
        }

        return null;
    }

    private static List<string> ExtractGenreTags(object? value)
    {
        if (value is null)
        {
            return [];
        }

        try
        {
            var json = value switch
            {
                string s => s,
                JsonElement el => el.GetRawText(),
                Newtonsoft.Json.Linq.JToken token => token.ToString(Newtonsoft.Json.Formatting.None),
                _ => Newtonsoft.Json.JsonConvert.SerializeObject(value),
            };

            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("GameGenre", out var genreNode))
            {
                return [];
            }

            if (!genreNode.TryGetProperty("Tags", out var tags) || tags.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            return tags.EnumerateArray()
                .Select(t => t.TryGetProperty("Text", out var text) ? text.GetString() : null)
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(8)
                .ToList();
        }
        catch (Exception)
        {
            return [];
        }
    }

    private async Task EnsureFileHashesAsync(GameFile file, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(file.Md5Hash) && !string.IsNullOrWhiteSpace(file.Sha1Hash))
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(file.StoragePath) || !File.Exists(file.StoragePath))
        {
            logger.LogDebug(
                "Cannot backfill hashes for file {FileId}: path missing or not found ({Path}).",
                file.Id,
                file.StoragePath ?? "(null)");
            return;
        }

        logger.LogInformation("Backfilling MD5/SHA1 for file {FileId} from disk.", file.Id);
        var hashes = await FileHashUtility.ComputeAllAsync(file.StoragePath, cancellationToken);
        file.ContentHash ??= hashes.Sha256;
        file.Md5Hash ??= hashes.Md5;
        file.Sha1Hash ??= hashes.Sha1;
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Backfilled hashes for {FileId}: md5={Md5} sha1={Sha1Prefix}…",
            file.Id,
            file.Md5Hash,
            file.Sha1Hash![..Math.Min(12, file.Sha1Hash.Length)]);
    }

    private async Task<List<string>> ResolveGenreNamesAsync(
        List<long>? genreIds,
        CancellationToken cancellationToken)
    {
        if (genreIds is null || genreIds.Count == 0 || !hasheous.HasApiKey)
        {
            return [];
        }

        var names = new List<string>();
        foreach (var genreId in genreIds.Take(8))
        {
            var genre = await hasheous.GetIgdbGenreAsync(genreId, cancellationToken);
            if (!string.IsNullOrWhiteSpace(genre?.Name))
            {
                names.Add(genre.Name);
            }
        }

        return names;
    }

    private static double ResolveConfidence(MatchMethod? method, bool enriched) =>
        method switch
        {
            MatchMethod.Manual or MatchMethod.ManualByAdmin or MatchMethod.Voted => enriched ? 0.95 : 0.7,
            MatchMethod.Automatic => enriched ? 0.8 : 0.6,
            _ => enriched ? 0.75 : 0.55,
        };

    private static string TruncateLabel(string value) =>
        value.Length <= 80 ? value : value[..77] + "…";

    private enum MatchAttemptStatus
    {
        Created,
        AlreadyQueued,
        NoHash,
        LookupMiss,
    }

    private readonly record struct MatchAttemptResult(MatchAttemptStatus Status, MetadataReviewItem? Item)
    {
        public static MatchAttemptResult Created(MetadataReviewItem item) => new(MatchAttemptStatus.Created, item);
        public static MatchAttemptResult AlreadyQueued() => new(MatchAttemptStatus.AlreadyQueued, null);
        public static MatchAttemptResult NoHash() => new(MatchAttemptStatus.NoHash, null);
        public static MatchAttemptResult LookupMiss() => new(MatchAttemptStatus.LookupMiss, null);
    }
}

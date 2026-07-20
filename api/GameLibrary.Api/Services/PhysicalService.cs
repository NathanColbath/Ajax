using HasheousClient.Models;
using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Engines;
using GameLibrary.Api.Entities;
using GameLibrary.Api.Mapping;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Services;

public class PhysicalService(
    AppDbContext db,
    CheckoutEngine checkoutEngine,
    HasheousMetadataClient hasheous,
    IgdbRatingClient igdb,
    ArtworkService artwork,
    IHttpClientFactory httpClientFactory,
    IAppEventLogger eventLogger,
    ILogger<PhysicalService> logger)
{
    private static readonly HashSet<string> AllowedConditions = new(StringComparer.OrdinalIgnoreCase)
    {
        "mint", "good", "fair", "poor",
    };

    private static readonly HashSet<string> AllowedCompleteness = new(StringComparer.OrdinalIgnoreCase)
    {
        "cib", "cart", "box", "loose",
    };

    public async Task<IReadOnlyList<PhysicalItemDto>> ListAsync(
        string? locationId,
        CancellationToken cancellationToken = default)
    {
        var query = db.PhysicalItems
            .Include(p => p.Location)
            .Include(p => p.Game)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(locationId))
        {
            query = query.Where(p => p.LocationId == locationId);
        }

        var items = await query.OrderBy(p => p.Title).ToListAsync(cancellationToken);
        return items.Select(EntityMappers.ToDto).ToList();
    }

    public async Task<IReadOnlyList<PhysicalTitleSearchResultDto>> SearchTitlesAsync(
        string? query,
        string? systemId,
        CancellationToken cancellationToken = default)
    {
        var q = query?.Trim() ?? string.Empty;
        if (q.Length < 2)
        {
            throw new InvalidOperationException("Search query must be at least 2 characters.");
        }

        string? platformHint = null;
        if (!string.IsNullOrWhiteSpace(systemId))
        {
            var system = await db.Systems.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == systemId, cancellationToken);
            platformHint = system?.Name ?? system?.ShortName;
        }

        var hits = await hasheous.SearchGamesByNameAsync(q, platformHint, 15, cancellationToken);
        if (hits.Count > 0)
        {
            return hits
                .Select(h => new PhysicalTitleSearchResultDto(
                    IgdbId: null,
                    Title: h.Title,
                    Year: h.Year,
                    Platforms: h.Platforms,
                    CoverUrl: null,
                    ExternalId: h.HasheousId?.ToString(),
                    Source: "hasheous",
                    SampleMd5: h.SampleMd5))
                .ToList();
        }

        var igdbHits = await igdb.SearchGamesAsync(q, 15, cancellationToken);
        return igdbHits
            .Select(h => new PhysicalTitleSearchResultDto(
                IgdbId: h.IgdbId,
                Title: h.Title,
                Year: h.Year,
                Platforms: h.Platforms,
                CoverUrl: h.CoverUrl,
                ExternalId: h.IgdbId.ToString(),
                Source: "igdb",
                SampleMd5: null))
            .ToList();
    }

    public async Task<PhysicalItemDto> CreateAsync(
        CreatePhysicalItemRequest request,
        CancellationToken cancellationToken = default)
    {
        var location = await db.Locations.FirstOrDefaultAsync(l => l.Id == request.LocationId, cancellationToken)
            ?? throw new InvalidOperationException("Location not found.");

        var system = await db.Systems.FirstOrDefaultAsync(s => s.Id == request.SystemId, cancellationToken)
            ?? throw new InvalidOperationException("System not found.");

        var condition = NormalizeChoice(request.Condition, AllowedConditions, "condition");
        var completeness = NormalizeChoice(request.Completeness, AllowedCompleteness, "completeness");

        long? igdbId = request.IgdbId;
        var title = request.Title?.Trim();
        int? yearFromSearch = null;
        string? sampleMd5 = string.IsNullOrWhiteSpace(request.SampleMd5)
            ? null
            : request.SampleMd5.Trim().ToLowerInvariant();

        LookupItemModel? lookup = null;
        if (!string.IsNullOrWhiteSpace(sampleMd5))
        {
            lookup = await hasheous.LookupAsync(sampleMd5, null, null, cancellationToken);
            var igdbMap = lookup?.Metadata?.FirstOrDefault(m =>
                string.Equals(m.Source, "IGDB", StringComparison.OrdinalIgnoreCase)
                && !string.IsNullOrWhiteSpace(m.Id));
            if (igdbId is null && igdbMap is not null && long.TryParse(igdbMap.Id, out var resolved))
            {
                igdbId = resolved;
            }

            if (string.IsNullOrWhiteSpace(title) && !string.IsNullOrWhiteSpace(lookup?.Name))
            {
                title = lookup.Name.Trim();
            }
        }

        if (string.IsNullOrWhiteSpace(title))
        {
            throw new InvalidOperationException("Title is required when metadata cannot be resolved.");
        }

        // Prefer IGDB id as ExternalId when known; otherwise keep Hasheous signature id.
        var externalId = igdbId?.ToString()
            ?? (string.IsNullOrWhiteSpace(request.ExternalId) ? null : request.ExternalId.Trim());

        Game? game = null;
        if (!string.IsNullOrWhiteSpace(externalId))
        {
            game = await db.Games.FirstOrDefaultAsync(
                g => g.ExternalId == externalId && g.System == system.ShortName,
                cancellationToken);
        }

        if (game is null && igdbId is long knownIgdb)
        {
            game = await db.Games.FirstOrDefaultAsync(
                g => g.ExternalId == knownIgdb.ToString() && g.System == system.ShortName,
                cancellationToken);
        }

        var createdNew = false;
        if (game is null)
        {
            game = new Game
            {
                Id = $"g{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                Title = title,
                System = system.ShortName,
                Owned = true,
                Accent = "#52687a",
                MetadataSource = igdbId is not null ? "IGDB" : "Hasheous",
                ExternalId = externalId ?? string.Empty,
                Year = yearFromSearch ?? 0,
            };
            db.Games.Add(game);
            createdNew = true;
        }

        // Always enrich from Hasheous hash lookup attributes when available (works without MetadataProxy).
        if (lookup is not null)
        {
            await ApplyHasheousLookupAsync(game, lookup, cancellationToken);
        }

        // Best-effort IGDB proxy (may 401); attributes above already applied.
        if (igdbId is long resolvedIgdb && (createdNew || !game.HasArt || string.IsNullOrWhiteSpace(game.Description)))
        {
            await ApplyIgdbMetadataAsync(game, resolvedIgdb, cancellationToken);
        }

        // Sync denormalized fields after enrichment.
        if (!string.IsNullOrWhiteSpace(game.Title))
        {
            title = game.Title;
        }

        var item = new PhysicalItem
        {
            Id = $"p{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            GameId = game.Id,
            Title = game.Title,
            System = game.System,
            Condition = condition,
            Completeness = completeness,
            LocationId = location.Id,
            Accent = string.IsNullOrWhiteSpace(game.Accent) ? "#52687a" : game.Accent,
            CheckedOut = false,
        };

        db.PhysicalItems.Add(item);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Physical",
            EventType = "Created",
            Message = $"Physical item created: {item.Title} ({item.System})"
                + (game.HasArt ? " with art" : " without art"),
            EntityType = "PhysicalItem",
            EntityId = item.Id,
        }, cancellationToken);

        item.Location = location;
        item.Game = game;
        return EntityMappers.ToDto(item);
    }

    public async Task<PhysicalItemDto?> UpdateAsync(
        string id,
        UpdatePhysicalItemRequest request,
        CancellationToken cancellationToken = default)
    {
        var item = await db.PhysicalItems
            .Include(p => p.Location)
            .Include(p => p.Game)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (item is null)
        {
            return null;
        }

        var location = await db.Locations.FirstOrDefaultAsync(l => l.Id == request.LocationId, cancellationToken)
            ?? throw new InvalidOperationException("Location not found.");

        item.LocationId = location.Id;
        item.Condition = NormalizeChoice(request.Condition, AllowedConditions, "condition");
        item.Completeness = NormalizeChoice(request.Completeness, AllowedCompleteness, "completeness");
        await db.SaveChangesAsync(cancellationToken);

        item.Location = location;
        return EntityMappers.ToDto(item);
    }

    public async Task<PhysicalItemDto?> ToggleCheckoutAsync(
        string id,
        string? borrower,
        CancellationToken cancellationToken = default)
    {
        var item = await checkoutEngine.ToggleCheckoutAsync(id, borrower, cancellationToken);
        if (item is null)
        {
            return null;
        }

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Physical",
            EventType = "CheckoutToggled",
            Message = $"Checkout toggled for {item.Title}: checkedOut={item.CheckedOut}",
            EntityType = "PhysicalItem",
            EntityId = item.Id,
        }, cancellationToken);

        // Reload game for hasArt in DTO.
        await db.Entry(item).Reference(p => p.Game).LoadAsync(cancellationToken);
        return EntityMappers.ToDto(item);
    }

    public async Task<DeleteStatus> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var item = await db.PhysicalItems.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (item is null)
        {
            return DeleteStatus.NotFound();
        }

        var title = item.Title;
        db.PhysicalItems.Remove(item);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Physical",
            EventType = "Deleted",
            Message = $"Physical item deleted: {title}",
            EntityType = "PhysicalItem",
            EntityId = id,
        }, cancellationToken);

        return DeleteStatus.Ok();
    }

    private async Task ApplyHasheousLookupAsync(
        Game game,
        LookupItemModel lookup,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(lookup.Name))
        {
            game.Title = lookup.Name.Trim();
        }

        if (string.IsNullOrWhiteSpace(game.MetadataSource))
        {
            game.MetadataSource = "Hasheous";
        }

        string? coverUrl = null;
        string? description = null;
        string? publisher = lookup.Publisher?.Name;
        int? year = null;
        var genres = new List<string>();
        var screenshots = new List<string>();

        ExtractLookupAttributes(lookup, ref coverUrl, ref description, ref publisher, ref year, genres, screenshots);

        if (!string.IsNullOrWhiteSpace(description) && string.IsNullOrWhiteSpace(game.Description))
        {
            game.Description = description;
        }

        if (year is int y && y > 0 && game.Year <= 0)
        {
            game.Year = y;
        }

        if (!string.IsNullOrWhiteSpace(publisher) && string.IsNullOrWhiteSpace(game.Publisher))
        {
            game.Publisher = publisher.Trim();
        }

        if (genres.Count > 0 && game.Genres.Count == 0)
        {
            game.Genres = genres;
        }

        if (!game.HasArt && !string.IsNullOrWhiteSpace(coverUrl))
        {
            try
            {
                var http = httpClientFactory.CreateClient();
                game.CoverPath = await artwork.SaveGameCoverFromUrlAsync(
                    game.Id,
                    coverUrl,
                    http,
                    cancellationToken);
                game.HasArt = true;
                logger.LogInformation("Applied Hasheous cover for physical game {GameId}.", game.Id);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to download Hasheous cover for {GameId}.", game.Id);
            }
        }
    }

    private async Task ApplyIgdbMetadataAsync(Game game, long igdbId, CancellationToken cancellationToken)
    {
        var igdbGame = await hasheous.GetIgdbGameAsync(igdbId, cancellationToken);
        if (igdbGame is null)
        {
            // Keep ExternalId as IGDB id for future enrichment even if proxy is unauthorized.
            if (string.IsNullOrWhiteSpace(game.ExternalId) || !long.TryParse(game.ExternalId, out _))
            {
                game.ExternalId = igdbId.ToString();
            }

            return;
        }

        if (!string.IsNullOrWhiteSpace(igdbGame.Name))
        {
            game.Title = igdbGame.Name.Trim();
        }

        game.ExternalId = igdbId.ToString();
        game.MetadataSource = "IGDB";

        var description = !string.IsNullOrWhiteSpace(igdbGame.Summary)
            ? igdbGame.Summary
            : igdbGame.Storyline;
        if (!string.IsNullOrWhiteSpace(description))
        {
            game.Description = description.Trim();
        }

        if (igdbGame.FirstReleaseDate is DateTimeOffset release)
        {
            game.Year = release.Year;
            game.ReleaseDate = release.ToString("yyyy-MM-dd");
        }

        if (!game.HasArt && igdbGame.Cover is long coverId and > 0)
        {
            var cover = await hasheous.GetIgdbCoverAsync(coverId, cancellationToken);
            var coverUrl = HasheousMetadataClient.BuildCoverUrl(cover);
            if (!string.IsNullOrWhiteSpace(coverUrl))
            {
                try
                {
                    var http = httpClientFactory.CreateClient();
                    game.CoverPath = await artwork.SaveGameCoverFromUrlAsync(
                        game.Id,
                        coverUrl,
                        http,
                        cancellationToken);
                    game.HasArt = true;
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to download IGDB cover for {GameId}.", game.Id);
                }
            }
        }
    }

    private static void ExtractLookupAttributes(
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
                    if (int.TryParse(attr.Value?.ToString()?.Trim(), out var parsedYear) && parsedYear > 0)
                    {
                        year = parsedYear;
                    }

                    break;
            }
        }

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

    private static string NormalizeChoice(string? value, HashSet<string> allowed, string field)
    {
        var trimmed = value?.Trim() ?? string.Empty;
        if (!allowed.Contains(trimmed))
        {
            throw new InvalidOperationException($"Invalid {field}.");
        }

        return trimmed.ToLowerInvariant();
    }
}

using System.Net.Http.Json;
using System.Text.Json;
using HasheousClient.Models;
using HasheousClient.WebApp;
using Microsoft.Extensions.Options;
using IgdbGame = HasheousClient.Models.Metadata.IGDB.Game;
using IgdbCover = HasheousClient.Models.Metadata.IGDB.Cover;
using IgdbGenre = HasheousClient.Models.Metadata.IGDB.Genre;

namespace GameLibrary.Api.Services;

/// <summary>
/// Thin wrapper around hasheous-client. HttpHelper is static and must be configured once at startup.
/// Hasheous primarily matches MD5/SHA1 (SHA256 often 404s).
/// </summary>
public class HasheousMetadataClient
{
    private static readonly object ConfigureLock = new();
    private static bool _httpHelperConfigured;

    private readonly HasheousClient.Hasheous _client = new();
    private readonly bool _hasApiKey;
    private readonly ILogger<HasheousMetadataClient> _logger;

    public HasheousMetadataClient(IOptions<HasheousOptions> options, ILogger<HasheousMetadataClient> logger)
    {
        _logger = logger;
        var settings = options.Value;
        ConfigureHttpHelper(settings);
        _hasApiKey = !string.IsNullOrWhiteSpace(settings.ApiKey);
        _logger.LogInformation(
            "HasheousMetadataClient ready (apiKey={HasKey}, baseUri={BaseUri}).",
            _hasApiKey,
            string.IsNullOrWhiteSpace(settings.BaseUri) ? "https://hasheous.org/" : settings.BaseUri);
    }

    public bool HasApiKey => _hasApiKey;

    /// <summary>
    /// HasheousClient.WebApp.HttpHelper uses a shared HttpClient; BaseUri/APIKey can only be set before the first request.
    /// </summary>
    public static void ConfigureHttpHelper(HasheousOptions settings)
    {
        lock (ConfigureLock)
        {
            if (_httpHelperConfigured)
            {
                return;
            }

            HttpHelper.BaseUri = string.IsNullOrWhiteSpace(settings.BaseUri)
                ? "https://hasheous.org/"
                : settings.BaseUri.TrimEnd('/') + "/";
            HttpHelper.APIKey = settings.ApiKey ?? string.Empty;
            // ClientKey is also consulted by hasheous-client for authenticated endpoints.
            HttpHelper.ClientKey = settings.ApiKey ?? string.Empty;
            _httpHelperConfigured = true;
        }
    }

    public async Task<LookupItemModel?> LookupAsync(
        string? md5,
        string? sha1,
        string? sha256,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        // Prefer MD5 then SHA1 — these are what Hasheous indexes reliably.
        if (!string.IsNullOrWhiteSpace(md5))
        {
            var byMd5 = await LookupOnceAsync(new HashLookupModel { MD5 = md5.Trim().ToLowerInvariant() }, "MD5", md5, cancellationToken);
            if (byMd5 is not null)
            {
                return byMd5;
            }
        }

        if (!string.IsNullOrWhiteSpace(sha1))
        {
            var bySha1 = await LookupOnceAsync(new HashLookupModel { SHA1 = sha1.Trim().ToLowerInvariant() }, "SHA1", sha1, cancellationToken);
            if (bySha1 is not null)
            {
                return bySha1;
            }
        }

        if (!string.IsNullOrWhiteSpace(sha256))
        {
            var bySha256 = await LookupOnceAsync(
                new HashLookupModel { SHA256 = sha256.Trim().ToLowerInvariant() },
                "SHA256",
                sha256,
                cancellationToken);
            if (bySha256 is not null)
            {
                return bySha256;
            }
        }

        _logger.LogInformation(
            "Hasheous lookup miss (md5={HasMd5}, sha1={HasSha1}, sha256={HasSha256}).",
            !string.IsNullOrWhiteSpace(md5),
            !string.IsNullOrWhiteSpace(sha1),
            !string.IsNullOrWhiteSpace(sha256));
        return null;
    }

    private Task<LookupItemModel?> LookupOnceAsync(
        HashLookupModel model,
        string algorithm,
        string hashValue,
        CancellationToken cancellationToken)
    {
        var prefix = hashValue.Length <= 12 ? hashValue : hashValue[..12];
        _logger.LogInformation("Hasheous {Algorithm} lookup starting ({HashPrefix}…).", algorithm, prefix);

        return Task.Run(
            () =>
            {
                try
                {
                    var result = _client.RetrieveFromHasheous(model, returnAllSources: true);
                    if (result is null)
                    {
                        _logger.LogInformation("Hasheous {Algorithm} lookup returned null ({HashPrefix}…).", algorithm, prefix);
                        return null;
                    }

                    var metaCount = result.Metadata?.Count ?? 0;
                    _logger.LogInformation(
                        "Hasheous {Algorithm} hit: name={Name}, metadataSources={MetaCount}, id={Id}.",
                        algorithm,
                        result.Name ?? "(none)",
                        metaCount,
                        result.Id);
                    return result;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(
                        ex,
                        "Hasheous {Algorithm} lookup failed ({HashPrefix}…): {Message}",
                        algorithm,
                        prefix,
                        ex.Message);
                    return null;
                }
            },
            cancellationToken);
    }

    public Task<IgdbGame?> GetIgdbGameAsync(long id, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_hasApiKey)
        {
            _logger.LogDebug("Skipping IGDB game proxy for {Id} — no API key.", id);
            return Task.FromResult<IgdbGame?>(null);
        }

        _logger.LogInformation("Hasheous IGDB game proxy request id={Id}.", id);
        return Task.Run(
            () =>
            {
                try
                {
                    var game = _client.GetMetadataProxy<IgdbGame>(MetadataSources.IGDB, id);
                    _logger.LogInformation(
                        "Hasheous IGDB game proxy result id={Id}: name={Name}, cover={Cover}.",
                        id,
                        game?.Name ?? "(null)",
                        game?.Cover ?? 0);
                    return game;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Hasheous IGDB game proxy failed for id={Id}.", id);
                    return null;
                }
            },
            cancellationToken);
    }

    public Task<IgdbCover?> GetIgdbCoverAsync(long coverId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_hasApiKey || coverId <= 0)
        {
            return Task.FromResult<IgdbCover?>(null);
        }

        _logger.LogInformation("Hasheous IGDB cover proxy request id={CoverId}.", coverId);
        return Task.Run(
            () =>
            {
                try
                {
                    return _client.GetMetadataProxy<IgdbCover>(MetadataSources.IGDB, coverId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Hasheous IGDB cover proxy failed for id={CoverId}.", coverId);
                    return null;
                }
            },
            cancellationToken);
    }

    public Task<IgdbGenre?> GetIgdbGenreAsync(long genreId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_hasApiKey || genreId <= 0)
        {
            return Task.FromResult<IgdbGenre?>(null);
        }

        return Task.Run(
            () =>
            {
                try
                {
                    return _client.GetMetadataProxy<IgdbGenre>(MetadataSources.IGDB, genreId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Hasheous IGDB genre proxy failed for id={GenreId}.", genreId);
                    return null;
                }
            },
            cancellationToken);
    }

    public static string? BuildCoverUrl(IgdbCover? cover)
    {
        if (cover is null)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(cover.ImageId))
        {
            return $"https://images.igdb.com/igdb/image/upload/t_cover_big/{cover.ImageId}.jpg";
        }

        if (!string.IsNullOrWhiteSpace(cover.Url))
        {
            var url = cover.Url.Trim();
            if (url.StartsWith("//", StringComparison.Ordinal))
            {
                return "https:" + url;
            }

            return url;
        }

        return null;
    }

    public async Task<IReadOnlyList<HasheousTitleSearchHit>> SearchGamesByNameAsync(
        string name,
        string? platform,
        int limit = 15,
        CancellationToken cancellationToken = default)
    {
        var trimmed = name.Trim();
        if (trimmed.Length < 2)
        {
            return [];
        }

        limit = Math.Clamp(limit, 1, 25);
        var baseUri = string.IsNullOrWhiteSpace(HttpHelper.BaseUri)
            ? "https://hasheous.org/"
            : HttpHelper.BaseUri;
        var url = new Uri(new Uri(baseUri), "api/v1/Mcp");

        var arguments = new Dictionary<string, object?>
        {
            ["name"] = trimmed,
            ["limit"] = limit,
            ["includeRoms"] = true,
        };
        if (!string.IsNullOrWhiteSpace(platform))
        {
            arguments["platform"] = platform.Trim();
        }

        var payload = new
        {
            jsonrpc = "2.0",
            id = 1,
            method = "tools/call",
            @params = new
            {
                name = "hasheous_search_games",
                arguments,
            },
        };

        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(45) };
            using var response = await http.PostAsJsonAsync(url, payload, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Hasheous MCP search returned {Status}.", (int)response.StatusCode);
                return [];
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            if (doc.RootElement.TryGetProperty("error", out _))
            {
                _logger.LogWarning("Hasheous MCP search JSON-RPC error for '{Name}'.", trimmed);
                return [];
            }

            if (!doc.RootElement.TryGetProperty("result", out var result))
            {
                return [];
            }

            if (result.TryGetProperty("isError", out var isError) && isError.ValueKind == JsonValueKind.True)
            {
                _logger.LogWarning("Hasheous MCP search tool error for '{Name}'.", trimmed);
                return [];
            }

            JsonElement gamesEl = default;
            var found = false;
            if (result.TryGetProperty("structuredContent", out var structured)
                && structured.TryGetProperty("games", out gamesEl))
            {
                found = true;
            }
            else if (result.TryGetProperty("content", out var content)
                     && content.ValueKind == JsonValueKind.Array
                     && content.GetArrayLength() > 0)
            {
                var text = content[0].TryGetProperty("text", out var textEl) ? textEl.GetString() : null;
                if (!string.IsNullOrWhiteSpace(text))
                {
                    using var inner = JsonDocument.Parse(text);
                    if (inner.RootElement.TryGetProperty("games", out gamesEl))
                    {
                        found = true;
                    }
                }
            }

            if (!found || gamesEl.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            var hits = new List<HasheousTitleSearchHit>();
            foreach (var game in gamesEl.EnumerateArray())
            {
                var title = game.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : null;
                if (string.IsNullOrWhiteSpace(title))
                {
                    continue;
                }

                long? hasheousId = null;
                if (game.TryGetProperty("id", out var idEl) && idEl.TryGetInt64(out var hid))
                {
                    hasheousId = hid;
                }

                int? year = null;
                if (game.TryGetProperty("year", out var yearEl))
                {
                    if (yearEl.ValueKind == JsonValueKind.Number && yearEl.TryGetInt32(out var y))
                    {
                        year = y;
                    }
                    else if (yearEl.ValueKind == JsonValueKind.String
                             && int.TryParse(yearEl.GetString(), out var ys))
                    {
                        year = ys;
                    }
                }

                var platforms = new List<string>();
                if (game.TryGetProperty("platform", out var platformEl)
                    && platformEl.ValueKind == JsonValueKind.Object
                    && platformEl.TryGetProperty("name", out var pname)
                    && !string.IsNullOrWhiteSpace(pname.GetString()))
                {
                    platforms.Add(pname.GetString()!);
                }

                string? sampleMd5 = null;
                if (game.TryGetProperty("roms", out var roms) && roms.ValueKind == JsonValueKind.Array)
                {
                    foreach (var rom in roms.EnumerateArray())
                    {
                        if (rom.TryGetProperty("md5", out var md5El)
                            && !string.IsNullOrWhiteSpace(md5El.GetString()))
                        {
                            sampleMd5 = md5El.GetString()!.Trim().ToLowerInvariant();
                            break;
                        }
                    }
                }

                hits.Add(new HasheousTitleSearchHit(
                    hasheousId,
                    title.Trim(),
                    year,
                    platforms,
                    sampleMd5));
            }

            return hits;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Hasheous MCP title search failed for '{Name}'.", trimmed);
            return [];
        }
    }
}

public record HasheousTitleSearchHit(
    long? HasheousId,
    string Title,
    int? Year,
    IReadOnlyList<string> Platforms,
    string? SampleMd5);

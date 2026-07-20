using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using GameLibrary.Api.Dtos;
using Microsoft.Extensions.Options;

namespace GameLibrary.Api.Services;

public sealed class RedditPublicFeedbackClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly HttpClient _http;
    private readonly ILogger<RedditPublicFeedbackClient> _logger;
    private readonly ConcurrentDictionary<string, CacheEntry> _cache = new(StringComparer.OrdinalIgnoreCase);

    public RedditPublicFeedbackClient(HttpClient http, ILogger<RedditPublicFeedbackClient> logger)
    {
        _http = http;
        _logger = logger;
        // Reddit's unauthenticated .json endpoints return 403; PullPush archives submissions.
        _http.BaseAddress = new Uri("https://api.pullpush.io/");
        _http.Timeout = TimeSpan.FromSeconds(20);
        _http.DefaultRequestHeaders.TryAddWithoutValidation(
            "User-Agent",
            "AjaxGameLibrary/1.0 (local-dev; +https://localhost)");
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public async Task<IReadOnlyList<GamePublicCommentDto>> SearchTopCommentsAsync(
        string title,
        string? system,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return [];
        }

        var cacheKey = $"{title.Trim().ToLowerInvariant()}|{system?.Trim().ToLowerInvariant()}";
        if (_cache.TryGetValue(cacheKey, out var cached) && cached.ExpiresAt > DateTimeOffset.UtcNow)
        {
            return cached.Comments;
        }

        try
        {
            var query = string.IsNullOrWhiteSpace(system)
                ? title.Trim()
                : $"{title.Trim()} {system.Trim()}";
            var url =
                $"reddit/search/submission/?q={Uri.EscapeDataString(query)}&size=5&sort=desc";

            using var response = await _http.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "PullPush Reddit archive search returned {Status} for '{Query}'.",
                    (int)response.StatusCode,
                    query);
                Cache(cacheKey, []);
                return [];
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var listing = await JsonSerializer.DeserializeAsync<PullPushListing>(stream, JsonOptions, cancellationToken);
            var comments = (listing?.Data ?? [])
                .Where(d => d is not null)
                .Select(d => ToComment(d!))
                .Where(c => !string.IsNullOrWhiteSpace(c.Text) || !string.IsNullOrWhiteSpace(c.Url))
                .Take(5)
                .ToList();

            Cache(cacheKey, comments);
            return comments;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "PullPush Reddit archive search failed for '{Title}'.", title);
            return [];
        }
    }

    private static GamePublicCommentDto ToComment(RedditPostData data)
    {
        var title = data.Title?.Trim() ?? string.Empty;
        var body = data.Selftext?.Trim() ?? string.Empty;
        if (body is "[removed]" or "[deleted]")
        {
            body = string.Empty;
        }

        var text = string.IsNullOrWhiteSpace(body)
            ? title
            : string.IsNullOrWhiteSpace(title)
                ? Truncate(body, 400)
                : Truncate($"{title} — {body}", 400);

        var permalink = data.Permalink?.Trim() ?? string.Empty;
        var url = string.IsNullOrWhiteSpace(permalink)
            ? data.Url ?? string.Empty
            : permalink.StartsWith("http", StringComparison.OrdinalIgnoreCase)
                ? permalink
                : "https://www.reddit.com" + (permalink.StartsWith('/') ? permalink : "/" + permalink);

        DateTimeOffset? created = null;
        if (data.CreatedUtc is > 0)
        {
            created = DateTimeOffset.FromUnixTimeSeconds((long)data.CreatedUtc.Value);
        }

        return new GamePublicCommentDto(
            string.IsNullOrWhiteSpace(data.Author) ? "Reddit" : data.Author!,
            text,
            created,
            url);
    }

    private void Cache(string key, IReadOnlyList<GamePublicCommentDto> comments) =>
        _cache[key] = new CacheEntry(comments, DateTimeOffset.UtcNow.AddHours(6));

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..(max - 1)] + "…";

    private sealed record CacheEntry(IReadOnlyList<GamePublicCommentDto> Comments, DateTimeOffset ExpiresAt);

    private sealed class PullPushListing
    {
        public List<RedditPostData>? Data { get; set; }
    }

    private sealed class RedditPostData
    {
        public string? Author { get; set; }
        public string? Title { get; set; }
        public string? Selftext { get; set; }
        public string? Permalink { get; set; }
        public string? Url { get; set; }

        [JsonPropertyName("created_utc")]
        public double? CreatedUtc { get; set; }
    }
}

public sealed class IgdbRatingClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly HttpClient _http;
    private readonly IgdbOptions _options;
    private readonly ILogger<IgdbRatingClient> _logger;
    private readonly SemaphoreSlim _tokenLock = new(1, 1);
    private string? _accessToken;
    private DateTimeOffset _tokenExpiresAt = DateTimeOffset.MinValue;
    private readonly ConcurrentDictionary<long, CacheEntry> _cache = new();

    public IgdbRatingClient(
        HttpClient http,
        IOptions<IgdbOptions> options,
        ILogger<IgdbRatingClient> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
        _http.Timeout = TimeSpan.FromSeconds(20);
    }

    public bool HasCredentials =>
        !string.IsNullOrWhiteSpace(_options.ClientId)
        && !string.IsNullOrWhiteSpace(_options.ClientSecret);

    public async Task<IgdbPublicRating?> GetRatingAsync(long igdbId, CancellationToken cancellationToken = default)
    {
        if (!HasCredentials || igdbId <= 0)
        {
            return null;
        }

        if (_cache.TryGetValue(igdbId, out var cached) && cached.ExpiresAt > DateTimeOffset.UtcNow)
        {
            return cached.Rating;
        }

        try
        {
            var token = await GetAccessTokenAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(token))
            {
                return null;
            }

            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.igdb.com/v4/games");
            request.Headers.TryAddWithoutValidation("Client-ID", _options.ClientId);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            request.Content = new StringContent(
                $"fields name,rating,rating_count,aggregated_rating,aggregated_rating_count,total_rating,total_rating_count,url; where id = {igdbId};",
                Encoding.UTF8,
                "text/plain");

            using var response = await _http.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "IGDB rating lookup returned {Status} for id={Id}.",
                    (int)response.StatusCode,
                    igdbId);
                return null;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var games = await JsonSerializer.DeserializeAsync<List<IgdbGameScore>>(stream, JsonOptions, cancellationToken);
            var game = games?.FirstOrDefault();
            if (game is null)
            {
                _cache[igdbId] = new CacheEntry(null, DateTimeOffset.UtcNow.AddHours(6));
                return null;
            }

            var rating = game.TotalRating ?? game.AggregatedRating ?? game.Rating;
            var count = game.TotalRatingCount ?? game.AggregatedRatingCount ?? game.RatingCount;
            var result = new IgdbPublicRating(
                rating,
                count,
                game.AggregatedRating is double critic ? (int)Math.Round(critic) : null,
                string.IsNullOrWhiteSpace(game.Url) ? $"https://www.igdb.com/games/{igdbId}" : game.Url!);

            _cache[igdbId] = new CacheEntry(result, DateTimeOffset.UtcNow.AddHours(6));
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "IGDB rating lookup failed for id={Id}.", igdbId);
            return null;
        }
    }

    public async Task<IReadOnlyList<IgdbTitleSearchHit>> SearchGamesAsync(
        string query,
        int limit = 15,
        CancellationToken cancellationToken = default)
    {
        if (!HasCredentials || string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
        {
            return [];
        }

        limit = Math.Clamp(limit, 1, 25);
        try
        {
            var token = await GetAccessTokenAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(token))
            {
                return [];
            }

            var escaped = query.Trim().Replace("\\", "\\\\").Replace("\"", "\\\"");
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.igdb.com/v4/games");
            request.Headers.TryAddWithoutValidation("Client-ID", _options.ClientId);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            request.Content = new StringContent(
                $"search \"{escaped}\"; fields name,first_release_date,platforms.name,cover.image_id; limit {limit};",
                Encoding.UTF8,
                "text/plain");

            using var response = await _http.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("IGDB title search returned {Status}.", (int)response.StatusCode);
                return [];
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var rows = await JsonSerializer.DeserializeAsync<List<IgdbSearchGame>>(stream, JsonOptions, cancellationToken);
            if (rows is null || rows.Count == 0)
            {
                return [];
            }

            return rows
                .Where(r => r.Id > 0 && !string.IsNullOrWhiteSpace(r.Name))
                .Select(r =>
                {
                    int? year = null;
                    if (r.FirstReleaseDate is long unix && unix > 0)
                    {
                        year = DateTimeOffset.FromUnixTimeSeconds(unix).Year;
                    }

                    var platforms = r.Platforms?
                        .Select(p => p.Name)
                        .Where(n => !string.IsNullOrWhiteSpace(n))
                        .Cast<string>()
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList() ?? [];

                    string? coverUrl = null;
                    if (!string.IsNullOrWhiteSpace(r.Cover?.ImageId))
                    {
                        coverUrl = $"https://images.igdb.com/igdb/image/upload/t_cover_big/{r.Cover!.ImageId}.jpg";
                    }

                    return new IgdbTitleSearchHit(r.Id, r.Name!.Trim(), year, platforms, coverUrl);
                })
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "IGDB title search failed for '{Query}'.", query);
            return [];
        }
    }

    private async Task<string?> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(_accessToken) && _tokenExpiresAt > DateTimeOffset.UtcNow.AddMinutes(1))
        {
            return _accessToken;
        }

        await _tokenLock.WaitAsync(cancellationToken);
        try
        {
            if (!string.IsNullOrWhiteSpace(_accessToken) && _tokenExpiresAt > DateTimeOffset.UtcNow.AddMinutes(1))
            {
                return _accessToken;
            }

            var url =
                "https://id.twitch.tv/oauth2/token"
                + $"?client_id={Uri.EscapeDataString(_options.ClientId)}"
                + $"&client_secret={Uri.EscapeDataString(_options.ClientSecret)}"
                + "&grant_type=client_credentials";

            using var response = await _http.PostAsync(url, null, cancellationToken);
            response.EnsureSuccessStatusCode();
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var token = await JsonSerializer.DeserializeAsync<TwitchTokenResponse>(stream, JsonOptions, cancellationToken);
            if (token is null || string.IsNullOrWhiteSpace(token.AccessToken))
            {
                return null;
            }

            _accessToken = token.AccessToken;
            _tokenExpiresAt = DateTimeOffset.UtcNow.AddSeconds(Math.Max(60, token.ExpiresIn - 60));
            return _accessToken;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to obtain Twitch/IGDB access token.");
            return null;
        }
        finally
        {
            _tokenLock.Release();
        }
    }

    private sealed record CacheEntry(IgdbPublicRating? Rating, DateTimeOffset ExpiresAt);

    private sealed class TwitchTokenResponse
    {
        [JsonPropertyName("access_token")]
        public string? AccessToken { get; set; }

        [JsonPropertyName("expires_in")]
        public int ExpiresIn { get; set; }
    }

    private sealed class IgdbGameScore
    {
        public double? Rating { get; set; }
        public int? RatingCount { get; set; }
        public double? AggregatedRating { get; set; }
        public int? AggregatedRatingCount { get; set; }
        public double? TotalRating { get; set; }
        public int? TotalRatingCount { get; set; }
        public string? Url { get; set; }
    }

    private sealed class IgdbSearchGame
    {
        public long Id { get; set; }
        public string? Name { get; set; }
        public long? FirstReleaseDate { get; set; }
        public List<IgdbSearchPlatform>? Platforms { get; set; }
        public IgdbSearchCover? Cover { get; set; }
    }

    private sealed class IgdbSearchPlatform
    {
        public string? Name { get; set; }
    }

    private sealed class IgdbSearchCover
    {
        [JsonPropertyName("image_id")]
        public string? ImageId { get; set; }
    }
}

public record IgdbTitleSearchHit(
    long IgdbId,
    string Title,
    int? Year,
    IReadOnlyList<string> Platforms,
    string? CoverUrl);

public record IgdbPublicRating(
    double? Rating,
    int? RatingsCount,
    int? CriticScore,
    string SourceUrl);

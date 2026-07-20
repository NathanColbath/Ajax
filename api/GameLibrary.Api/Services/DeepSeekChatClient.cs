using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace GameLibrary.Api.Services;

public sealed class DeepSeekChatClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly HttpClient _http;
    private readonly DeepSeekOptions _options;
    private readonly ILogger<DeepSeekChatClient> _logger;

    public DeepSeekChatClient(
        HttpClient http,
        IOptions<DeepSeekOptions> options,
        IOptions<HttpClientOptions> httpOptions,
        ILogger<DeepSeekChatClient> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;

        var baseUrl = string.IsNullOrWhiteSpace(_options.BaseUrl)
            ? "https://api.deepseek.com"
            : _options.BaseUrl.TrimEnd('/') + "/";
        _http.BaseAddress = new Uri(baseUrl);
        var timeoutSec = Math.Clamp(httpOptions.Value.EnrichmentTimeoutSeconds, 10, 600);
        _http.Timeout = TimeSpan.FromSeconds(timeoutSec);
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public bool HasApiKey => !string.IsNullOrWhiteSpace(_options.ApiKey);

    public async Task<DeepSeekEnrichmentResult?> EnrichGameAsync(
        DeepSeekEnrichmentRequest request,
        CancellationToken cancellationToken = default,
        double? temperature = null)
    {
        if (!HasApiKey)
        {
            return null;
        }

        var systemPrompt =
            """
            You curate public game reception for a private game library.
            Return ONLY a JSON object with this shape:
            {
              "rating": number|null,
              "ratingScale": 100,
              "ratingsCount": number|null,
              "criticScore": number|null,
              "reviews": [{"sourceName": string, "sourceUrl": string|null, "excerpt": string}],
              "screenshotUrls": [string]
            }
            Rules:
            - rating is 0-100 when known; otherwise null.
            - Up to 3 short review excerpts (1-2 sentences each). Prefer real known reception; label vaguely if unsure.
            - Never invent URLs. Use null/omit sourceUrl and screenshotUrls when you cannot provide a real URL.
            - screenshotUrls: only real public image URLs you are confident about; otherwise [].
            - Do not invent fake Reddit/IGDB/Metacritic links.
            """;

        var userPrompt =
            $"""
            Game: {request.Title}
            System: {request.System}
            Year: {(request.Year > 0 ? request.Year.ToString() : "unknown")}
            Publisher: {request.Publisher}
            Description: {Truncate(request.Description, 600)}
            """;

        var body = new
        {
            model = string.IsNullOrWhiteSpace(_options.Model) ? "deepseek-chat" : _options.Model,
            messages = new object[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userPrompt },
            },
            response_format = new { type = "json_object" },
            temperature = Math.Clamp(temperature ?? 0.3, 0, 2),
        };

        using var message = new HttpRequestMessage(HttpMethod.Post, "chat/completions");
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey.Trim());
        message.Content = new StringContent(JsonSerializer.Serialize(body, JsonOptions), Encoding.UTF8, "application/json");

        using var response = await _http.SendAsync(message, cancellationToken);
        var raw = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "DeepSeek enrichment failed for '{Title}': {Status} {Body}",
                request.Title,
                (int)response.StatusCode,
                Truncate(raw, 400));
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(raw);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(content))
            {
                return null;
            }

            return JsonSerializer.Deserialize<DeepSeekEnrichmentResult>(content, JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse DeepSeek enrichment for '{Title}'.", request.Title);
            return null;
        }
    }

    private static string Truncate(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var trimmed = value.Trim();
        return trimmed.Length <= max ? trimmed : trimmed[..(max - 1)] + "…";
    }
}

public sealed record DeepSeekEnrichmentRequest(
    string Title,
    string System,
    int Year,
    string Publisher,
    string Description);

public sealed class DeepSeekEnrichmentResult
{
    public double? Rating { get; set; }
    public int? RatingScale { get; set; }
    public int? RatingsCount { get; set; }
    public int? CriticScore { get; set; }
    public List<DeepSeekReviewItem> Reviews { get; set; } = [];
    public List<string> ScreenshotUrls { get; set; } = [];
}

public sealed class DeepSeekReviewItem
{
    public string? SourceName { get; set; }
    public string? SourceUrl { get; set; }
    public string? Excerpt { get; set; }
}

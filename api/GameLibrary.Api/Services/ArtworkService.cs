namespace GameLibrary.Api.Services;

public class ArtworkService(FileStorageService fileStorage, ILogger<ArtworkService> logger)
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".webp", ".gif",
    };

    private const int MaxDownloadAttempts = 4;

    public async Task<string> SaveGameCoverAsync(
        string gameId,
        Stream content,
        string originalFileName,
        CancellationToken cancellationToken = default)
    {
        return await SaveNamedAsync("games", gameId, "cover", content, originalFileName, cancellationToken);
    }

    public async Task<string> SaveGameScreenshotAsync(
        string gameId,
        int index,
        Stream content,
        string originalFileName,
        CancellationToken cancellationToken = default)
    {
        return await SaveNamedAsync("games", gameId, $"screenshot-{index}", content, originalFileName, cancellationToken);
    }

    public async Task<string> SaveSystemLogoAsync(
        string systemId,
        Stream content,
        string originalFileName,
        CancellationToken cancellationToken = default)
    {
        return await SaveNamedAsync("systems", systemId, "logo", content, originalFileName, cancellationToken);
    }

    public async Task<string> SaveGameCoverFromUrlAsync(
        string gameId,
        string url,
        HttpClient httpClient,
        CancellationToken cancellationToken = default)
    {
        var (stream, mediaType) = await DownloadImageAsync(url, httpClient, cancellationToken);
        await using (stream)
        {
            var ext = GuessExtension(url, mediaType);
            return await SaveNamedAsync("games", gameId, "cover", stream, $"cover{ext}", cancellationToken);
        }
    }

    public async Task<string> SaveGameScreenshotFromUrlAsync(
        string gameId,
        int index,
        string url,
        HttpClient httpClient,
        CancellationToken cancellationToken = default)
    {
        var (stream, mediaType) = await DownloadImageAsync(url, httpClient, cancellationToken);
        await using (stream)
        {
            var ext = GuessExtension(url, mediaType);
            return await SaveNamedAsync(
                "games",
                gameId,
                $"screenshot-{index}",
                stream,
                $"screenshot{ext}",
                cancellationToken);
        }
    }

    /// <summary>
    /// Downloads an image with retries on 429/503 so bulk Accept does not hammer CDNs.
    /// </summary>
    private async Task<(MemoryStream Stream, string? MediaType)> DownloadImageAsync(
        string url,
        HttpClient httpClient,
        CancellationToken cancellationToken)
    {
        Exception? lastError = null;

        for (var attempt = 1; attempt <= MaxDownloadAttempts; attempt++)
        {
            using var response = await httpClient.GetAsync(url, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                var mediaType = response.Content.Headers.ContentType?.MediaType;
                var buffer = new MemoryStream();
                await response.Content.CopyToAsync(buffer, cancellationToken);
                buffer.Position = 0;
                return (buffer, mediaType);
            }

            var status = (int)response.StatusCode;
            if (status is 429 or 503)
            {
                var delay = GetRetryDelay(response, attempt);
                logger.LogWarning(
                    "Image download {Status} for {Url} (attempt {Attempt}/{Max}); waiting {DelayMs}ms.",
                    status,
                    url,
                    attempt,
                    MaxDownloadAttempts,
                    (int)delay.TotalMilliseconds);
                await Task.Delay(delay, cancellationToken);
                lastError = new HttpRequestException(
                    $"Response status code does not indicate success: {status} ({response.ReasonPhrase}).");
                continue;
            }

            response.EnsureSuccessStatusCode();
        }

        throw lastError ?? new HttpRequestException($"Failed to download image from {url}.");
    }

    private static TimeSpan GetRetryDelay(HttpResponseMessage response, int attempt)
    {
        if (response.Headers.RetryAfter?.Delta is { } delta && delta > TimeSpan.Zero)
        {
            return delta < TimeSpan.FromSeconds(30) ? delta : TimeSpan.FromSeconds(30);
        }

        // Exponential backoff: 500ms, 1s, 2s, 4s
        return TimeSpan.FromMilliseconds(500 * Math.Pow(2, attempt - 1));
    }

    private async Task<string> SaveNamedAsync(
        string entityType,
        string entityId,
        string baseName,
        Stream content,
        string originalFileName,
        CancellationToken cancellationToken)
    {
        var ext = NormalizeExtension(Path.GetExtension(originalFileName));
        if (!AllowedExtensions.Contains(ext))
        {
            throw new InvalidOperationException($"Unsupported image type '{ext}'. Allowed: png, jpg, jpeg, webp, gif.");
        }

        var dir = fileStorage.GetArtworkDir(entityType, entityId);

        // Remove previous files with the same base name (any extension).
        foreach (var existing in Directory.EnumerateFiles(dir, $"{baseName}.*"))
        {
            fileStorage.TryDeleteFile(existing);
        }

        var path = Path.Combine(dir, $"{baseName}{ext}");
        await using var output = File.Create(path);
        await content.CopyToAsync(output, cancellationToken);
        return path;
    }

    private static string NormalizeExtension(string extension)
    {
        if (string.IsNullOrWhiteSpace(extension))
        {
            return ".png";
        }

        return extension.StartsWith('.') ? extension.ToLowerInvariant() : $".{extension.ToLowerInvariant()}";
    }

    private static string GuessExtension(string url, string? mediaType)
    {
        try
        {
            var fromUrl = Path.GetExtension(new Uri(url).AbsolutePath);
            if (!string.IsNullOrWhiteSpace(fromUrl) && AllowedExtensions.Contains(fromUrl))
            {
                return fromUrl.ToLowerInvariant();
            }
        }
        catch (UriFormatException)
        {
            // fall through
        }

        return mediaType?.ToLowerInvariant() switch
        {
            "image/jpeg" => ".jpg",
            "image/webp" => ".webp",
            "image/gif" => ".gif",
            _ => ".png",
        };
    }
}

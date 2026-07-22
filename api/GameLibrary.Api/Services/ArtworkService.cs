using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace GameLibrary.Api.Services;

public class ArtworkService(FileStorageService fileStorage, ILogger<ArtworkService> logger)
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".webp", ".gif",
    };

    private const int MaxDownloadAttempts = 4;
    private const int CoverThumbMaxEdge = 320;
    private const string CoverThumbBaseName = "cover-thumb";

    public async Task<string> SaveGameCoverAsync(
        string gameId,
        Stream content,
        string originalFileName,
        CancellationToken cancellationToken = default)
    {
        var path = await SaveNamedAsync("games", gameId, "cover", content, originalFileName, cancellationToken);
        await TryGenerateCoverThumbAsync(path, cancellationToken);
        return path;
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
            var path = await SaveNamedAsync("games", gameId, "cover", stream, $"cover{ext}", cancellationToken);
            await TryGenerateCoverThumbAsync(path, cancellationToken);
            return path;
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

        // Cover saves also replace any prior thumb variant.
        if (string.Equals(baseName, "cover", StringComparison.OrdinalIgnoreCase))
        {
            DeleteCoverThumbs(dir);
        }

        var path = Path.Combine(dir, $"{baseName}{ext}");
        await using var output = File.Create(path);
        await content.CopyToAsync(output, cancellationToken);
        return path;
    }

    /// <summary>
    /// Deletes cover-thumb.* next to a game cover (used on cover replace/delete).
    /// </summary>
    public void DeleteGameCoverThumbs(string gameId)
    {
        var dir = fileStorage.GetArtworkDir("games", gameId);
        DeleteCoverThumbs(dir);
    }

    public string? FindGameCoverThumbPath(string gameId)
    {
        var dir = fileStorage.GetArtworkDir("games", gameId);
        return Directory.EnumerateFiles(dir, $"{CoverThumbBaseName}.*").FirstOrDefault();
    }

    private async Task TryGenerateCoverThumbAsync(string coverPath, CancellationToken cancellationToken)
    {
        try
        {
            var dir = Path.GetDirectoryName(coverPath);
            if (string.IsNullOrWhiteSpace(dir))
            {
                return;
            }

            DeleteCoverThumbs(dir);
            var thumbPath = Path.Combine(dir, $"{CoverThumbBaseName}.webp");

            await using var input = File.OpenRead(coverPath);
            using var image = await Image.LoadAsync(input, cancellationToken);
            image.Mutate(ctx => ctx.Resize(new ResizeOptions
            {
                Size = new Size(CoverThumbMaxEdge, CoverThumbMaxEdge),
                Mode = ResizeMode.Max,
            }));

            await image.SaveAsWebpAsync(thumbPath, new WebpEncoder { Quality = 80 }, cancellationToken);
            logger.LogDebug("Generated cover thumb at {ThumbPath}", thumbPath);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to generate cover thumb for {CoverPath}", coverPath);
        }
    }

    private void DeleteCoverThumbs(string dir)
    {
        if (!Directory.Exists(dir))
        {
            return;
        }

        foreach (var existing in Directory.EnumerateFiles(dir, $"{CoverThumbBaseName}.*"))
        {
            fileStorage.TryDeleteFile(existing);
        }
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

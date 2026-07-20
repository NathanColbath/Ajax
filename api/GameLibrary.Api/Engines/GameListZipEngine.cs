using System.IO.Compression;
using System.Text;
using GameLibrary.Api.Data;
using GameLibrary.Api.Entities;
using GameLibrary.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GameLibrary.Api.Engines;

public class GameListZipEngine(
    AppDbContext db,
    FileStorageService fileStorage,
    IOptions<StorageOptions> storageOptions,
    IAppEventLogger eventLogger,
    ILogger<GameListZipEngine> logger)
{
    public async Task<(string FilePath, string FileName)> BuildAsync(
        GameListDownloadJob job,
        CancellationToken cancellationToken = default)
    {
        var root = Path.GetFullPath(storageOptions.Value.RootPath);
        var exportDir = Path.Combine(root, "list-exports", SanitizeSegment(job.UserId));
        Directory.CreateDirectory(exportDir);

        var safeListName = SanitizeSegment(job.ListName);
        if (string.IsNullOrWhiteSpace(safeListName))
        {
            safeListName = "list";
        }

        var fileName = $"{safeListName}-{job.Id}.zip";
        var filePath = Path.Combine(exportDir, fileName);
        var tempPath = filePath + ".partial";

        if (File.Exists(tempPath))
        {
            File.Delete(tempPath);
        }

        var items = await db.UserGameListItems
            .AsNoTracking()
            .Where(i => i.ListId == job.ListId)
            .Include(i => i.Game!)
            .ThenInclude(g => g.Files)
            .OrderBy(i => i.Game!.Title)
            .ToListAsync(cancellationToken);

        var files = items
            .SelectMany(i => (i.Game?.Files ?? []).Select(f => (Game: i.Game!, File: f)))
            .Where(x => !string.IsNullOrWhiteSpace(x.File.StoragePath))
            .ToList();

        var total = Math.Max(files.Count, 1);
        var written = 0;
        var usedEntryNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        await using (var zipStream = new FileStream(
            tempPath,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 1024 * 64,
            options: FileOptions.Asynchronous | FileOptions.SequentialScan))
        await using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Create, leaveOpen: false))
        {
            foreach (var (game, file) in files)
            {
                cancellationToken.ThrowIfCancellationRequested();

                if (!fileStorage.TryOpenRead(file.StoragePath, out var source) || source is null)
                {
                    logger.LogWarning(
                        "Skipping missing list zip file {FileId} for game {GameId} ({Path})",
                        file.Id,
                        game.Id,
                        file.StoragePath);
                    written++;
                    await UpdateProgressAsync(job.Id, written, total, cancellationToken);
                    continue;
                }

                await using (source)
                {
                    var folder = SanitizeSegment(game.Title);
                    if (string.IsNullOrWhiteSpace(folder))
                    {
                        folder = game.Id;
                    }

                    var entryName = UniqueEntryName(
                        usedEntryNames,
                        $"{folder}/{SanitizeFileName(file.Name)}");

                    var entry = archive.CreateEntry(entryName, CompressionLevel.Fastest);
                    await using var entryStream = entry.Open();
                    await source.CopyToAsync(entryStream, cancellationToken);
                }

                written++;
                await UpdateProgressAsync(job.Id, written, total, cancellationToken);

                if (written % 5 == 0)
                {
                    await Task.Delay(25, cancellationToken);
                }
            }
        }

        if (File.Exists(filePath))
        {
            File.Delete(filePath);
        }

        File.Move(tempPath, filePath);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Lists",
            EventType = "ZipCompleted",
            Message = $"List ZIP ready: {fileName} ({written} file(s))",
            EntityType = "GameListDownloadJob",
            EntityId = job.Id,
        }, cancellationToken);

        return (filePath, fileName);
    }

    private async Task UpdateProgressAsync(
        string jobId,
        int written,
        int total,
        CancellationToken cancellationToken)
    {
        var progress = (int)Math.Clamp(Math.Round(100.0 * written / total), 0, 99);
        var row = await db.GameListDownloadJobs.FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);
        if (row is null)
        {
            return;
        }

        row.Progress = progress;
        row.Message = $"Packing {written} of {total}…";
        await db.SaveChangesAsync(cancellationToken);
    }

    private static string UniqueEntryName(HashSet<string> used, string candidate)
    {
        if (used.Add(candidate))
        {
            return candidate;
        }

        var dir = Path.GetDirectoryName(candidate)?.Replace('\\', '/') ?? string.Empty;
        var baseName = Path.GetFileNameWithoutExtension(candidate);
        var ext = Path.GetExtension(candidate);
        for (var i = 2; ; i++)
        {
            var next = string.IsNullOrEmpty(dir)
                ? $"{baseName}-{i}{ext}"
                : $"{dir}/{baseName}-{i}{ext}";
            if (used.Add(next))
            {
                return next;
            }
        }
    }

    private static string SanitizeSegment(string value)
    {
        var sb = new StringBuilder(value.Length);
        foreach (var c in value.Trim())
        {
            if (c is '/' or '\\' || Path.GetInvalidFileNameChars().Contains(c))
            {
                sb.Append('_');
            }
            else
            {
                sb.Append(c);
            }
        }

        var result = sb.ToString().Trim();
        return string.IsNullOrWhiteSpace(result) ? "item" : result;
    }

    private static string SanitizeFileName(string name)
    {
        var fileName = FileStorageService.SanitizeFileName(name);
        return string.IsNullOrWhiteSpace(fileName) ? "file.bin" : fileName;
    }
}

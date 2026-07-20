using GameLibrary.Api.Data;
using GameLibrary.Api.Entities;
using GameLibrary.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Engines;

public class UploadProcessingEngine(
    AppDbContext db,
    DuplicateEngine duplicateEngine,
    FileStorageService fileStorage,
    MetadataMatchEngine metadataMatchEngine,
    IAppEventLogger eventLogger,
    ILogger<UploadProcessingEngine> logger)
{
    public async Task ProcessUploadJobAsync(string jobId, CancellationToken cancellationToken = default)
    {
        UploadJob? job = null;
        for (var attempt = 0; attempt < 5; attempt++)
        {
            job = await db.UploadJobs.FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);
            if (job is not null)
            {
                break;
            }

            await Task.Delay(50 * (attempt + 1), cancellationToken);
        }

        if (job is null)
        {
            return;
        }

        if (await IsCancelledAsync(jobId, cancellationToken))
        {
            return;
        }

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Uploads",
            EventType = "Started",
            Message = $"Upload processing started: {job.Name}",
            EntityType = "UploadJob",
            EntityId = jobId,
        }, cancellationToken);

        BackgroundJob? backgroundJob = null;
        if (!string.IsNullOrWhiteSpace(job.BackgroundJobId))
        {
            backgroundJob = await db.BackgroundJobs
                .FirstOrDefaultAsync(b => b.Id == job.BackgroundJobId, cancellationToken);
            if (backgroundJob is not null)
            {
                backgroundJob.Status = "running";
                backgroundJob.StartedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(cancellationToken);
            }
        }

        try
        {
            if (await IsCancelledAsync(jobId, cancellationToken))
            {
                return;
            }

            if (string.IsNullOrWhiteSpace(job.StoragePath) || !File.Exists(job.StoragePath))
            {
                await SetProgressAsync(job, 0, "error", "Upload file not found on disk.", cancellationToken);
                await FailBackgroundJobAsync(backgroundJob, "Upload file not found on disk.", cancellationToken);

                await eventLogger.WriteAsync(new AppLogEvent
                {
                    Level = "Error",
                    Category = "Uploads",
                    EventType = "Failed",
                    Message = $"Upload processing failed: file not found for {job.Name}",
                    EntityType = "UploadJob",
                    EntityId = jobId,
                }, cancellationToken);
                return;
            }

            if (string.IsNullOrWhiteSpace(job.SystemId))
            {
                await SetProgressAsync(job, 0, "error", "System is required.", cancellationToken);
                await FailBackgroundJobAsync(backgroundJob, "System is required.", cancellationToken);
                return;
            }

            var system = await db.Systems.FirstOrDefaultAsync(s => s.Id == job.SystemId, cancellationToken);
            if (system is null)
            {
                await SetProgressAsync(job, 0, "error", "System not found.", cancellationToken);
                await FailBackgroundJobAsync(backgroundJob, "System not found.", cancellationToken);
                return;
            }

            await SetProgressAsync(job, 10, "processing", null, cancellationToken);

            if (await IsCancelledAsync(jobId, cancellationToken))
            {
                return;
            }

            var hashes = await FileHashUtility.ComputeAllAsync(job.StoragePath, cancellationToken);
            job.ContentHash = hashes.Sha256;
            await SetProgressAsync(job, 40, "processing", null, cancellationToken);
            logger.LogInformation(
                "Upload {JobId} hashes computed sha256={Sha256Prefix}… md5={Md5} sha1={Sha1Prefix}…",
                jobId,
                hashes.Sha256[..Math.Min(12, hashes.Sha256.Length)],
                hashes.Md5,
                hashes.Sha1[..Math.Min(12, hashes.Sha1.Length)]);

            if (await IsCancelledAsync(jobId, cancellationToken))
            {
                return;
            }

            var (game, isNewGame) = await ResolveGameAsync(job, system, cancellationToken);
            if (game is null)
            {
                await SetProgressAsync(job, 0, "error", "Unable to resolve game.", cancellationToken);
                await FailBackgroundJobAsync(backgroundJob, "Unable to resolve game.", cancellationToken);
                return;
            }

            if (isNewGame)
            {
                system.GameCount++;
            }

            job.GameId = game.Id;
            await SetProgressAsync(job, 55, "processing", null, cancellationToken);

            if (await IsCancelledAsync(jobId, cancellationToken))
            {
                return;
            }

            var ext = Path.GetExtension(job.Name);
            if (string.IsNullOrEmpty(ext))
            {
                ext = ".bin";
            }

            var fileId = $"f{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
            var libraryDir = fileStorage.GetLibraryDir(game.Id);
            var libraryPath = Path.Combine(libraryDir, $"{fileId}{ext}");

            File.Move(job.StoragePath, libraryPath, overwrite: true);
            job.StoragePath = libraryPath;

            var gameFile = new GameFile
            {
                Id = fileId,
                GameId = game.Id,
                Name = job.Name,
                SizeLabel = FormatSizeLabel(job.Size),
                Extension = ext,
                StoragePath = libraryPath,
                ContentHash = hashes.Sha256,
                Md5Hash = hashes.Md5,
                Sha1Hash = hashes.Sha1,
            };

            db.GameFiles.Add(gameFile);
            await db.SaveChangesAsync(cancellationToken);
            await SetProgressAsync(job, 75, "processing", null, cancellationToken);

            if (isNewGame)
            {
                var sysConfig = await db.SystemConfig.FirstOrDefaultAsync(cancellationToken);
                if (sysConfig?.AutoMatchAfterUpload != false)
                {
                    try
                    {
                        logger.LogInformation(
                            "Running post-upload metadata match for game {GameId} ({Title}).",
                            game.Id,
                            game.Title);
                        var review = await metadataMatchEngine.MatchSingleGameAsync(game.Id, cancellationToken);
                        logger.LogInformation(
                            "Post-upload metadata match for game {GameId}: {Result}.",
                            game.Id,
                            review is null ? "no match" : $"queued review {review.Id} ({review.SuggestedTitle})");
                    }
                    catch (Exception ex)
                    {
                        // Metadata match is best-effort; upload should still complete.
                        logger.LogWarning(ex, "Post-upload metadata match failed for game {GameId}; upload continues.", game.Id);
                    }
                }
            }

            if (await IsCancelledAsync(jobId, cancellationToken))
            {
                return;
            }

            await duplicateEngine.RegisterDuplicateAsync(
                job.Name,
                libraryPath,
                gameFile.SizeLabel,
                job.SystemId,
                hashes.Sha256,
                cancellationToken);

            if (await IsCancelledAsync(jobId, cancellationToken))
            {
                return;
            }

            await SetProgressAsync(job, 100, "complete", null, cancellationToken);
            await CompleteBackgroundJobAsync(backgroundJob, cancellationToken);

            await eventLogger.WriteAsync(new AppLogEvent
            {
                Category = "Uploads",
                EventType = "Completed",
                Message = $"Upload processing completed: {job.Name}",
                EntityType = "UploadJob",
                EntityId = jobId,
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            await SetProgressAsync(job, 0, "error", ex.Message, cancellationToken);
            await FailBackgroundJobAsync(backgroundJob, ex.Message, cancellationToken);

            await eventLogger.WriteAsync(new AppLogEvent
            {
                Level = "Error",
                Category = "Uploads",
                EventType = "Failed",
                Message = $"Upload processing failed: {job.Name}",
                EntityType = "UploadJob",
                EntityId = jobId,
                Exception = ex.ToString(),
            }, cancellationToken);

            throw;
        }
    }

    private async Task<(Game? Game, bool IsNew)> ResolveGameAsync(
        UploadJob job,
        GameSystem system,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(job.GameId))
        {
            var existing = await db.Games.FirstOrDefaultAsync(g => g.Id == job.GameId, cancellationToken);
            return (existing, false);
        }

        var title = !string.IsNullOrWhiteSpace(job.CreateTitle)
            ? job.CreateTitle.Trim()
            : Path.GetFileNameWithoutExtension(job.Name);

        var game = new Game
        {
            Id = $"g{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            Title = title,
            System = system.ShortName,
            Region = string.Empty,
            Year = 0,
            Owned = true,
            HasArt = false,
            Accent = "#52687a",
            Rating = 0,
            RatingCount = 0,
            DownloadCount = 0,
        };

        db.Games.Add(game);
        await db.SaveChangesAsync(cancellationToken);
        return (game, true);
    }

    private async Task<bool> IsCancelledAsync(string jobId, CancellationToken cancellationToken)
    {
        var snapshot = await db.UploadJobs.AsNoTracking()
            .Where(j => j.Id == jobId)
            .Select(j => new { j.State, j.Message })
            .FirstOrDefaultAsync(cancellationToken);

        if (snapshot is null)
        {
            return true;
        }

        return string.Equals(snapshot.State, "error", StringComparison.OrdinalIgnoreCase)
            || string.Equals(snapshot.State, "cancelled", StringComparison.OrdinalIgnoreCase)
            || string.Equals(snapshot.Message, "Cancelled", StringComparison.OrdinalIgnoreCase);
    }

    private async Task FailBackgroundJobAsync(
        BackgroundJob? backgroundJob,
        string message,
        CancellationToken cancellationToken)
    {
        if (backgroundJob is null)
        {
            return;
        }

        backgroundJob.Status = "failed";
        backgroundJob.ErrorMessage = message;
        backgroundJob.CompletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task CompleteBackgroundJobAsync(
        BackgroundJob? backgroundJob,
        CancellationToken cancellationToken)
    {
        if (backgroundJob is null)
        {
            return;
        }

        backgroundJob.Status = "complete";
        backgroundJob.CompletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    public static string FormatSizeLabel(long bytes)
    {
        if (bytes >= 1_000_000_000)
        {
            return $"{bytes / 1_000_000_000d:0.0} GB";
        }

        if (bytes >= 1_000_000)
        {
            return $"{bytes / 1_000_000d:0.0} MB";
        }

        if (bytes >= 1_000)
        {
            return $"{bytes / 1_000d:0.0} KB";
        }

        return $"{bytes} B";
    }

    private async Task SetProgressAsync(
        UploadJob job,
        int progress,
        string state,
        string? message,
        CancellationToken cancellationToken)
    {
        job.Progress = progress;
        job.State = state;
        job.Message = message;
        await db.SaveChangesAsync(cancellationToken);
    }
}

using GameLibrary.Api.Auth;
using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Engines;
using GameLibrary.Api.Entities;
using GameLibrary.Api.Jobs;
using GameLibrary.Api.Mapping;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Services;

public class UploadsService(
    AppDbContext db,
    IBackgroundJobQueue jobQueue,
    FileStorageService fileStorage,
    FileDownloadService fileDownload,
    ICurrentUserService currentUser,
    IAppEventLogger eventLogger)
{
    private static readonly HashSet<string> ActiveStates = new(StringComparer.OrdinalIgnoreCase)
    {
        "queued", "running", "processing", "uploading",
    };

    public async Task<IReadOnlyList<UploadJobDto>> ListAsync(CancellationToken cancellationToken = default)
    {
        var jobs = await db.UploadJobs
            .OrderByDescending(j => j.Id)
            .ToListAsync(cancellationToken);

        return jobs.Select(EntityMappers.ToDto).ToList();
    }

    public async Task<IReadOnlyList<UploadJobDto>> EnqueueAsync(
        IFormFileCollection files,
        string systemId,
        string? gameId,
        string? createTitle,
        CancellationToken cancellationToken = default)
    {
        if (files.Count == 0)
        {
            return [];
        }

        if (string.IsNullOrWhiteSpace(systemId))
        {
            throw new InvalidOperationException("System is required.");
        }

        var config = await db.SystemConfig.FirstOrDefaultAsync(cancellationToken);
        if (config is { AllowStandardUploads: false } && !currentUser.IsAtLeast(Roles.Admin))
        {
            throw new InvalidOperationException("Standard uploads are disabled.");
        }

        var system = await db.Systems.FirstOrDefaultAsync(s => s.Id == systemId, cancellationToken);
        if (system is null)
        {
            throw new InvalidOperationException("System not found.");
        }

        if (!string.IsNullOrWhiteSpace(gameId))
        {
            var game = await db.Games.FirstOrDefaultAsync(g => g.Id == gameId, cancellationToken);
            if (game is null)
            {
                throw new InvalidOperationException("Game not found.");
            }

            if (!string.Equals(game.System, system.ShortName, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(game.System, system.Name, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Game does not belong to the selected system.");
            }
        }

        foreach (var file in files)
        {
            var ext = Path.GetExtension(file.FileName);
            if (string.IsNullOrEmpty(ext)
                || !system.Extensions.Any(e => string.Equals(e, ext, StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException(
                    $"File extension '{ext}' is not allowed for {system.Name}.");
            }
        }

        fileStorage.EnsureRoot();

        var created = new List<UploadJob>();
        var index = 0;
        foreach (var file in files)
        {
            var jobId = $"u{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{index++}";
            var uploadDir = fileStorage.GetUploadDir(jobId);
            var safeName = FileStorageService.SanitizeFileName(file.FileName);
            var storagePath = Path.Combine(uploadDir, safeName);

            await using (var stream = File.Create(storagePath))
            {
                await file.CopyToAsync(stream, cancellationToken);
            }

            var backgroundJob = new BackgroundJob
            {
                Id = $"bj{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{index}",
                JobType = "Upload",
                Status = "queued",
                PayloadJson = jobId,
                CreatedAt = DateTimeOffset.UtcNow,
            };

            var job = new UploadJob
            {
                Id = jobId,
                Name = safeName,
                Size = file.Length,
                Progress = 5,
                State = "queued",
                SystemId = systemId,
                GameId = gameId,
                CreateTitle = createTitle,
                StoragePath = storagePath,
                BackgroundJobId = backgroundJob.Id,
            };

            db.BackgroundJobs.Add(backgroundJob);
            db.UploadJobs.Add(job);
            created.Add(job);
        }

        // Persist before channel work so the worker never races an empty DB lookup.
        await db.SaveChangesAsync(cancellationToken);

        foreach (var job in created)
        {
            var jobId = job.Id;
            await jobQueue.QueueBackgroundWorkItemAsync(new BackgroundWorkItem
            {
                JobType = "upload",
                Work = async (sp, ct) =>
                {
                    var engine = sp.GetRequiredService<UploadProcessingEngine>();
                    await engine.ProcessUploadJobAsync(jobId, ct);
                },
            }, cancellationToken);

            await eventLogger.WriteAsync(new AppLogEvent
            {
                Category = "Uploads",
                EventType = "Enqueued",
                Message = $"Upload enqueued: {job.Name}",
                EntityType = "UploadJob",
                EntityId = job.Id,
            }, cancellationToken);
        }

        return created.Select(EntityMappers.ToDto).ToList();
    }

    public async Task<IReadOnlyList<UploadJobDto>> CancelAsync(
        string id,
        CancellationToken cancellationToken = default)
    {
        var job = await db.UploadJobs.FirstOrDefaultAsync(j => j.Id == id, cancellationToken);
        if (job is not null && !string.Equals(job.State, "complete", StringComparison.OrdinalIgnoreCase))
        {
            job.State = "error";
            job.Progress = 0;
            job.Message = "Cancelled";

            if (!string.IsNullOrWhiteSpace(job.BackgroundJobId))
            {
                var backgroundJob = await db.BackgroundJobs
                    .FirstOrDefaultAsync(b => b.Id == job.BackgroundJobId, cancellationToken);
                if (backgroundJob is not null)
                {
                    backgroundJob.Status = "cancelled";
                    backgroundJob.ErrorMessage = "Cancelled";
                    backgroundJob.CompletedAt = DateTimeOffset.UtcNow;
                }
            }

            fileStorage.TryDeleteFile(job.StoragePath);
            await db.SaveChangesAsync(cancellationToken);

            await eventLogger.WriteAsync(new AppLogEvent
            {
                Category = "Uploads",
                EventType = "Cancelled",
                Message = $"Upload cancelled: {job.Name}",
                EntityType = "UploadJob",
                EntityId = job.Id,
            }, cancellationToken);
        }

        return await ListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<UploadJobDto>> RetryAsync(
        string id,
        CancellationToken cancellationToken = default)
    {
        var job = await db.UploadJobs.FirstOrDefaultAsync(j => j.Id == id, cancellationToken);
        if (job is null)
        {
            return await ListAsync(cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(job.StoragePath) || !File.Exists(job.StoragePath))
        {
            job.State = "error";
            job.Message = "Upload file not found on disk.";
            await db.SaveChangesAsync(cancellationToken);
            return await ListAsync(cancellationToken);
        }

        var backgroundJob = new BackgroundJob
        {
            Id = $"bj{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            JobType = "Upload",
            Status = "queued",
            PayloadJson = job.Id,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        job.State = "queued";
        job.Progress = 10;
        job.Message = null;
        job.BackgroundJobId = backgroundJob.Id;

        db.BackgroundJobs.Add(backgroundJob);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Uploads",
            EventType = "Retry",
            Message = $"Upload retry enqueued: {job.Name}",
            EntityType = "UploadJob",
            EntityId = job.Id,
        }, cancellationToken);

        await jobQueue.QueueBackgroundWorkItemAsync(new BackgroundWorkItem
        {
            JobType = "upload",
            Work = async (sp, ct) =>
            {
                var engine = sp.GetRequiredService<UploadProcessingEngine>();
                await engine.ProcessUploadJobAsync(id, ct);
            },
        }, cancellationToken);

        return await ListAsync(cancellationToken);
    }

    public FileStreamResult? Download(string id)
    {
        var job = db.UploadJobs.AsNoTracking().FirstOrDefault(j => j.Id == id);
        if (job is null
            || !string.Equals(job.State, "complete", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(job.StoragePath))
        {
            return null;
        }

        return fileDownload.OpenAttachment(job.StoragePath, job.Name);
    }

    public async Task<DeleteStatus> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var job = await db.UploadJobs.FirstOrDefaultAsync(j => j.Id == id, cancellationToken);
        if (job is null)
        {
            return DeleteStatus.NotFound();
        }

        if (ActiveStates.Contains(job.State))
        {
            return DeleteStatus.Invalid("Cancel the upload first; only completed or failed jobs can be deleted.");
        }

        fileStorage.TryDeleteFile(job.StoragePath);
        fileStorage.TryDeleteDirectory(fileStorage.GetUploadDirPath(id));

        db.UploadJobs.Remove(job);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Uploads",
            EventType = "Deleted",
            Message = $"Upload job deleted: {job.Name}",
            EntityType = "UploadJob",
            EntityId = id,
        }, cancellationToken);

        return DeleteStatus.Ok();
    }

    public async Task<int> RecoverActiveJobsAsync(CancellationToken cancellationToken = default)
    {
        var jobs = await db.UploadJobs
            .Where(j => ActiveStates.Contains(j.State))
            .ToListAsync(cancellationToken);

        foreach (var job in jobs)
        {
            job.State = "queued";
        }

        await db.SaveChangesAsync(cancellationToken);

        foreach (var job in jobs)
        {
            var jobId = job.Id;
            await jobQueue.QueueBackgroundWorkItemAsync(new BackgroundWorkItem
            {
                JobType = "upload",
                Work = async (sp, ct) =>
                {
                    var engine = sp.GetRequiredService<UploadProcessingEngine>();
                    await engine.ProcessUploadJobAsync(jobId, ct);
                },
            }, cancellationToken);
        }

        return jobs.Count;
    }
}

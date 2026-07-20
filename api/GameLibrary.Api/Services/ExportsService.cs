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

public class ExportsService(
    AppDbContext db,
    IBackgroundJobQueue jobQueue,
    ExportEngine exportEngine,
    FileDownloadService fileDownload,
    FileStorageService fileStorage,
    ICurrentUserService currentUser,
    IAppEventLogger eventLogger)
{
    private static readonly HashSet<string> ActiveStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "queued", "running", "processing",
    };

    public async Task<IReadOnlyList<ExportJobDto>> ListJobsAsync(CancellationToken cancellationToken = default)
    {
        var jobs = await db.ExportJobs.OrderByDescending(j => j.Id).ToListAsync(cancellationToken);
        return jobs.Select(EntityMappers.ToDto).ToList();
    }

    public async Task<IReadOnlyList<ExportJobDto>> RunAsync(
        RunExportRequest request,
        CancellationToken cancellationToken = default)
    {
        var config = await db.SystemConfig.FirstOrDefaultAsync(cancellationToken);
        if (config is { AllowStandardExports: false } && !currentUser.IsAtLeast(Roles.Admin))
        {
            throw new InvalidOperationException("Standard exports are disabled.");
        }

        var job = new ExportJob
        {
            Id = $"e{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            Format = request.Format,
            Scopes = request.Scopes.ToList(),
            Status = "queued",
            CreatedLabel = "Just now",
        };

        db.ExportJobs.Add(job);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Exports",
            EventType = "Enqueued",
            Message = $"Export enqueued: {job.Format} ({string.Join(", ", job.Scopes)})",
            EntityType = "ExportJob",
            EntityId = job.Id,
        }, cancellationToken);

        await jobQueue.QueueBackgroundWorkItemAsync(new BackgroundWorkItem
        {
            JobType = "export",
            Work = async (sp, ct) =>
            {
                var service = sp.GetRequiredService<ExportsService>();
                await service.ProcessExportJobAsync(job.Id, ct);
            },
        }, cancellationToken);

        return await ListJobsAsync(cancellationToken);
    }

    public async Task<int> RecoverActiveJobsAsync(CancellationToken cancellationToken = default)
    {
        var jobs = await db.ExportJobs
            .Where(j => ActiveStatuses.Contains(j.Status))
            .ToListAsync(cancellationToken);

        foreach (var job in jobs)
        {
            job.Status = "queued";
            await jobQueue.QueueBackgroundWorkItemAsync(new BackgroundWorkItem
            {
                JobType = "export",
                Work = async (sp, ct) =>
                {
                    var service = sp.GetRequiredService<ExportsService>();
                    await service.ProcessExportJobAsync(job.Id, ct);
                },
            }, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        return jobs.Count;
    }

    public async Task ProcessExportJobAsync(string jobId, CancellationToken cancellationToken)
    {
        var job = await db.ExportJobs.FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);
        if (job is null)
        {
            return;
        }

        job.Status = "running";
        await db.SaveChangesAsync(cancellationToken);

        try
        {
            var filePath = await exportEngine.ExportAsync(job, cancellationToken);
            job.StoragePath = filePath;
            job.FileName = Path.GetFileName(filePath);
            job.Status = "complete";
            job.CreatedLabel = $"Today · {DateTime.Now:HH:mm}";
        }
        catch (Exception ex)
        {
            job.Status = "error";
            job.CreatedLabel = ex.Message;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public FileStreamResult? Download(string id)
    {
        var job = db.ExportJobs.AsNoTracking().FirstOrDefault(j => j.Id == id);
        if (job is null
            || !string.Equals(job.Status, "complete", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(job.StoragePath))
        {
            return null;
        }

        var fileName = job.FileName ?? Path.GetFileName(job.StoragePath);
        return fileDownload.OpenAttachment(job.StoragePath, fileName);
    }

    public async Task<DeleteStatus> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var job = await db.ExportJobs.FirstOrDefaultAsync(j => j.Id == id, cancellationToken);
        if (job is null)
        {
            return DeleteStatus.NotFound();
        }

        if (ActiveStatuses.Contains(job.Status))
        {
            return DeleteStatus.Invalid("Cannot delete an export that is still running.");
        }

        fileStorage.TryDeleteFile(job.StoragePath);
        db.ExportJobs.Remove(job);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Exports",
            EventType = "Deleted",
            Message = $"Export job deleted: {id}",
            EntityType = "ExportJob",
            EntityId = id,
        }, cancellationToken);

        return DeleteStatus.Ok();
    }
}

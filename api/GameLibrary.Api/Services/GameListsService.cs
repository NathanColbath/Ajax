using GameLibrary.Api.Auth;
using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Engines;
using GameLibrary.Api.Entities;
using GameLibrary.Api.Jobs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Services;

public class GameListsService(
    AppDbContext db,
    AuthService authService,
    IBackgroundJobQueue jobQueue,
    GameListZipEngine zipEngine,
    FileDownloadService fileDownload,
    FileStorageService fileStorage,
    IAppEventLogger eventLogger)
{
    private static readonly HashSet<string> ActiveStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "queued", "processing",
    };

    public async Task<IReadOnlyList<UserGameListSummaryDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var user = await RequireUserAsync(cancellationToken);
        var lists = await db.UserGameLists
            .AsNoTracking()
            .Where(l => l.UserId == user.Id)
            .OrderByDescending(l => l.UpdatedAt)
            .Select(l => new UserGameListSummaryDto(
                l.Id,
                l.Name,
                l.Items.Count,
                l.UpdatedAt))
            .ToListAsync(cancellationToken);

        return lists;
    }

    public async Task<UserGameListDetailDto?> GetAsync(
        string id,
        CancellationToken cancellationToken = default)
    {
        var user = await RequireUserAsync(cancellationToken);
        var list = await db.UserGameLists
            .AsNoTracking()
            .Where(l => l.Id == id && l.UserId == user.Id)
            .Select(l => new
            {
                l.Id,
                l.Name,
                l.CreatedAt,
                l.UpdatedAt,
                Games = l.Items
                    .OrderBy(i => i.Game!.Title)
                    .Select(i => new UserGameListGameDto(
                        i.GameId,
                        i.Game!.Title,
                        i.Game.System,
                        i.Game.Files.Any(),
                        i.Game.Accent,
                        i.Game.HasArt))
                    .ToList(),
            })
            .FirstOrDefaultAsync(cancellationToken);

        return list is null
            ? null
            : new UserGameListDetailDto(list.Id, list.Name, list.CreatedAt, list.UpdatedAt, list.Games);
    }

    public async Task<UserGameListSummaryDto> CreateAsync(
        CreateUserGameListRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await RequireUserAsync(cancellationToken);
        var name = NormalizeName(request.Name);
        var now = DateTimeOffset.UtcNow;
        var list = new UserGameList
        {
            Id = $"ugl{now.ToUnixTimeMilliseconds()}",
            UserId = user.Id,
            Name = name,
            CreatedAt = now,
            UpdatedAt = now,
        };

        db.UserGameLists.Add(list);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Lists",
            EventType = "Created",
            Message = $"List created: {list.Name}",
            EntityType = "UserGameList",
            EntityId = list.Id,
        }, cancellationToken);

        return new UserGameListSummaryDto(list.Id, list.Name, 0, list.UpdatedAt);
    }

    public async Task<UserGameListSummaryDto?> RenameAsync(
        string id,
        UpdateUserGameListRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await RequireUserAsync(cancellationToken);
        var list = await db.UserGameLists
            .Include(l => l.Items)
            .FirstOrDefaultAsync(l => l.Id == id && l.UserId == user.Id, cancellationToken);
        if (list is null)
        {
            return null;
        }

        list.Name = NormalizeName(request.Name);
        list.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return new UserGameListSummaryDto(list.Id, list.Name, list.Items.Count, list.UpdatedAt);
    }

    public async Task<DeleteStatus> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var user = await RequireUserAsync(cancellationToken);
        var list = await db.UserGameLists
            .FirstOrDefaultAsync(l => l.Id == id && l.UserId == user.Id, cancellationToken);
        if (list is null)
        {
            return DeleteStatus.NotFound();
        }

        db.UserGameLists.Remove(list);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Lists",
            EventType = "Deleted",
            Message = $"List deleted: {list.Name}",
            EntityType = "UserGameList",
            EntityId = id,
        }, cancellationToken);

        return DeleteStatus.Ok();
    }

    public async Task<UserGameListDetailDto?> AddGameAsync(
        string listId,
        AddGameToListRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await RequireUserAsync(cancellationToken);
        var list = await db.UserGameLists
            .FirstOrDefaultAsync(l => l.Id == listId && l.UserId == user.Id, cancellationToken);
        if (list is null)
        {
            return null;
        }

        var gameId = request.GameId?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(gameId))
        {
            throw new InvalidOperationException("Game id is required.");
        }

        var gameExists = await db.Games.AnyAsync(g => g.Id == gameId, cancellationToken);
        if (!gameExists)
        {
            throw new InvalidOperationException("Game not found.");
        }

        var already = await db.UserGameListItems
            .AnyAsync(i => i.ListId == listId && i.GameId == gameId, cancellationToken);
        if (!already)
        {
            var now = DateTimeOffset.UtcNow;
            db.UserGameListItems.Add(new UserGameListItem
            {
                Id = $"ugli{now.ToUnixTimeMilliseconds()}-{Random.Shared.Next(1000, 9999)}",
                ListId = listId,
                GameId = gameId,
                AddedAt = now,
            });
            list.UpdatedAt = now;
            await db.SaveChangesAsync(cancellationToken);
        }

        return await GetAsync(listId, cancellationToken);
    }

    public async Task<DeleteStatus> RemoveGameAsync(
        string listId,
        string gameId,
        CancellationToken cancellationToken = default)
    {
        var user = await RequireUserAsync(cancellationToken);
        var list = await db.UserGameLists
            .FirstOrDefaultAsync(l => l.Id == listId && l.UserId == user.Id, cancellationToken);
        if (list is null)
        {
            return DeleteStatus.NotFound();
        }

        var item = await db.UserGameListItems
            .FirstOrDefaultAsync(i => i.ListId == listId && i.GameId == gameId, cancellationToken);
        if (item is null)
        {
            return DeleteStatus.NotFound();
        }

        db.UserGameListItems.Remove(item);
        list.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return DeleteStatus.Ok();
    }

    public async Task<GameListDownloadJobDto?> EnqueueDownloadAsync(
        string listId,
        CancellationToken cancellationToken = default)
    {
        var user = await RequireUserAsync(cancellationToken);
        var list = await db.UserGameLists
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == listId && l.UserId == user.Id, cancellationToken);
        if (list is null)
        {
            return null;
        }

        var now = DateTimeOffset.UtcNow;
        var job = new GameListDownloadJob
        {
            Id = $"ldj{now.ToUnixTimeMilliseconds()}",
            UserId = user.Id,
            ListId = list.Id,
            ListName = list.Name,
            Status = "queued",
            Progress = 0,
            Message = "Queued",
            CreatedAt = now,
        };

        db.GameListDownloadJobs.Add(job);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Lists",
            EventType = "DownloadEnqueued",
            Message = $"List download queued: {list.Name}",
            EntityType = "GameListDownloadJob",
            EntityId = job.Id,
        }, cancellationToken);

        await jobQueue.QueueBackgroundWorkItemAsync(new BackgroundWorkItem
        {
            JobType = "list-zip",
            Work = async (sp, ct) =>
            {
                var service = sp.GetRequiredService<GameListsService>();
                await service.ProcessDownloadJobAsync(job.Id, ct);
            },
        }, cancellationToken);

        return ToJobDto(job);
    }

    public async Task<IReadOnlyList<GameListDownloadJobDto>> ListDownloadJobsAsync(
        CancellationToken cancellationToken = default)
    {
        var user = await RequireUserAsync(cancellationToken);
        var jobs = await db.GameListDownloadJobs
            .AsNoTracking()
            .Where(j => j.UserId == user.Id)
            .OrderByDescending(j => j.CreatedAt)
            .ToListAsync(cancellationToken);

        return jobs.Select(ToJobDto).ToList();
    }

    public async Task<int> RecoverActiveJobsAsync(CancellationToken cancellationToken = default)
    {
        var jobs = await db.GameListDownloadJobs
            .Where(j => ActiveStatuses.Contains(j.Status))
            .ToListAsync(cancellationToken);

        foreach (var job in jobs)
        {
            job.Status = "queued";
            job.Message = "Recovered";
            await jobQueue.QueueBackgroundWorkItemAsync(new BackgroundWorkItem
            {
                JobType = "list-zip",
                Work = async (sp, ct) =>
                {
                    var service = sp.GetRequiredService<GameListsService>();
                    await service.ProcessDownloadJobAsync(job.Id, ct);
                },
            }, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        return jobs.Count;
    }

    public async Task ProcessDownloadJobAsync(string jobId, CancellationToken cancellationToken)
    {
        var job = await db.GameListDownloadJobs.FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);
        if (job is null)
        {
            return;
        }

        job.Status = "processing";
        job.Progress = 0;
        job.Message = "Building ZIP…";
        await db.SaveChangesAsync(cancellationToken);

        try
        {
            var (filePath, fileName) = await zipEngine.BuildAsync(job, cancellationToken);
            job.FilePath = filePath;
            job.FileName = fileName;
            job.Status = "complete";
            job.Progress = 100;
            job.Message = "Ready";
            job.CompletedAt = DateTimeOffset.UtcNow;
        }
        catch (Exception ex)
        {
            job.Status = "error";
            job.Message = ex.Message;
            job.CompletedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<FileStreamResult?> DownloadJobFileAsync(
        string jobId,
        CancellationToken cancellationToken = default)
    {
        var user = await RequireUserAsync(cancellationToken);
        var job = await db.GameListDownloadJobs
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == jobId && j.UserId == user.Id, cancellationToken);

        if (job is null
            || !string.Equals(job.Status, "complete", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(job.FilePath))
        {
            return null;
        }

        var fileName = job.FileName ?? Path.GetFileName(job.FilePath);
        return fileDownload.OpenAttachment(job.FilePath, fileName);
    }

    public async Task<DeleteStatus> DeleteDownloadJobAsync(
        string jobId,
        CancellationToken cancellationToken = default)
    {
        var user = await RequireUserAsync(cancellationToken);
        var job = await db.GameListDownloadJobs
            .FirstOrDefaultAsync(j => j.Id == jobId && j.UserId == user.Id, cancellationToken);
        if (job is null)
        {
            return DeleteStatus.NotFound();
        }

        if (ActiveStatuses.Contains(job.Status))
        {
            return DeleteStatus.Invalid("Cannot delete a download that is still running.");
        }

        fileStorage.TryDeleteFile(job.FilePath);
        db.GameListDownloadJobs.Remove(job);
        await db.SaveChangesAsync(cancellationToken);
        return DeleteStatus.Ok();
    }

    private async Task<AppUser> RequireUserAsync(CancellationToken cancellationToken)
    {
        var user = await authService.EnsureUserAsync(cancellationToken);
        if (user is null)
        {
            throw new InvalidOperationException("Authentication required.");
        }

        return user;
    }

    private static string NormalizeName(string? name)
    {
        var trimmed = name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            throw new InvalidOperationException("List name is required.");
        }

        if (trimmed.Length > 120)
        {
            throw new InvalidOperationException("List name must be 120 characters or fewer.");
        }

        return trimmed;
    }

    private static GameListDownloadJobDto ToJobDto(GameListDownloadJob job) =>
        new(
            job.Id,
            job.ListId,
            job.ListName,
            job.Status,
            job.Progress,
            job.FileName,
            job.Message,
            job.CreatedAt,
            job.CompletedAt);
}

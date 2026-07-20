using GameLibrary.Api.Data;
using GameLibrary.Api.Entities;
using GameLibrary.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Engines;

public class DuplicateEngine(AppDbContext db, IAppEventLogger eventLogger)
{
    public async Task RegisterDuplicateAsync(
        string fileName,
        string filePath,
        string sizeLabel,
        string? systemId,
        string contentHash,
        CancellationToken cancellationToken = default)
    {
        var systemName = systemId is null
            ? "Unknown"
            : await db.Systems
                .Where(s => s.Id == systemId)
                .Select(s => s.ShortName)
                .FirstOrDefaultAsync(cancellationToken) ?? "Unknown";

        var existingGroup = await db.DuplicateGroups
            .Include(g => g.Files)
            .FirstOrDefaultAsync(g => g.Hash == contentHash, cancellationToken);

        var groupCreated = false;

        if (existingGroup is null)
        {
            var otherJob = await db.UploadJobs
                .Where(j => j.ContentHash == contentHash && j.StoragePath != filePath)
                .FirstOrDefaultAsync(cancellationToken);

            if (otherJob is null)
            {
                return;
            }

            existingGroup = new DuplicateGroup
            {
                Id = $"d{Guid.NewGuid():N}"[..10],
                Hash = TruncateHash(contentHash),
            };

            db.DuplicateGroups.Add(existingGroup);
            groupCreated = true;
            db.DuplicateFiles.Add(new DuplicateFile
            {
                Id = $"df{Guid.NewGuid():N}"[..10],
                DuplicateGroupId = existingGroup.Id,
                Name = otherJob.Name,
                Path = otherJob.StoragePath ?? string.Empty,
                SizeLabel = UploadProcessingEngine.FormatSizeLabel(otherJob.Size),
                System = systemName,
            });
        }

        if (existingGroup.Files.Any(f => f.Path == filePath))
        {
            return;
        }

        db.DuplicateFiles.Add(new DuplicateFile
        {
            Id = $"df{Guid.NewGuid():N}"[..10],
            DuplicateGroupId = existingGroup.Id,
            Name = fileName,
            Path = filePath,
            SizeLabel = sizeLabel,
            System = systemName,
        });

        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Duplicates",
            EventType = groupCreated ? "GroupCreated" : "GroupUpdated",
            Message = groupCreated
                ? $"Duplicate group created for hash {existingGroup.Hash}"
                : $"Duplicate group updated: {existingGroup.Id}",
            EntityType = "DuplicateGroup",
            EntityId = existingGroup.Id,
        }, cancellationToken);
    }

    public async Task<IReadOnlyList<DuplicateGroup>> ScanUploadHashesAsync(CancellationToken cancellationToken = default)
    {
        var jobs = await db.UploadJobs
            .Where(j => j.ContentHash != null && j.StoragePath != null)
            .ToListAsync(cancellationToken);

        var groups = jobs
            .GroupBy(j => j.ContentHash!)
            .Where(g => g.Count() > 1);

        var createdCount = 0;
        var updatedCount = 0;

        foreach (var group in groups)
        {
            var hash = group.Key;
            var duplicateGroup = await db.DuplicateGroups
                .Include(g => g.Files)
                .FirstOrDefaultAsync(g => g.Hash == TruncateHash(hash) || g.Hash == hash, cancellationToken);

            var groupCreated = false;

            duplicateGroup ??= new DuplicateGroup
            {
                Id = $"d{Guid.NewGuid():N}"[..10],
                Hash = TruncateHash(hash),
            };

            if (duplicateGroup.Id.StartsWith("d") && duplicateGroup.Files.Count == 0)
            {
                db.DuplicateGroups.Add(duplicateGroup);
                groupCreated = true;
            }

            var filesAdded = 0;
            foreach (var job in group)
            {
                if (duplicateGroup.Files.Any(f => f.Path == job.StoragePath))
                {
                    continue;
                }

                var systemName = job.SystemId is null
                    ? "Unknown"
                    : await db.Systems
                        .Where(s => s.Id == job.SystemId)
                        .Select(s => s.ShortName)
                        .FirstOrDefaultAsync(cancellationToken) ?? "Unknown";

                db.DuplicateFiles.Add(new DuplicateFile
                {
                    Id = $"df{Guid.NewGuid():N}"[..10],
                    DuplicateGroupId = duplicateGroup.Id,
                    Name = job.Name,
                    Path = job.StoragePath!,
                    SizeLabel = UploadProcessingEngine.FormatSizeLabel(job.Size),
                    System = systemName,
                });
                filesAdded++;
            }

            if (groupCreated)
            {
                createdCount++;
            }
            else if (filesAdded > 0)
            {
                updatedCount++;
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        if (createdCount > 0)
        {
            await eventLogger.WriteAsync(new AppLogEvent
            {
                Category = "Duplicates",
                EventType = "GroupCreated",
                Message = $"Duplicate scan created {createdCount} group(s)",
            }, cancellationToken);
        }

        if (updatedCount > 0)
        {
            await eventLogger.WriteAsync(new AppLogEvent
            {
                Category = "Duplicates",
                EventType = "GroupUpdated",
                Message = $"Duplicate scan updated {updatedCount} group(s)",
            }, cancellationToken);
        }

        return await db.DuplicateGroups.Include(g => g.Files).ToListAsync(cancellationToken);
    }

    private static string TruncateHash(string hash) =>
        hash.Length <= 12 ? hash : $"{hash[..6]}…{hash[^4..]}";
}

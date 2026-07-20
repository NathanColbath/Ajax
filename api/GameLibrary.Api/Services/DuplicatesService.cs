using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Mapping;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Services;

public class DuplicatesService(AppDbContext db, IAppEventLogger eventLogger)
{
    public async Task<IReadOnlyList<DuplicateGroupDto>> ListAsync(CancellationToken cancellationToken = default)
    {
        var groups = await db.DuplicateGroups
            .Include(g => g.Files)
            .OrderByDescending(g => g.Id)
            .ToListAsync(cancellationToken);

        return groups.Select(EntityMappers.ToDto).ToList();
    }

    public async Task<IReadOnlyList<DuplicateGroupDto>> KeepAsync(
        string groupId,
        string fileId,
        CancellationToken cancellationToken = default)
    {
        var group = await db.DuplicateGroups
            .Include(g => g.Files)
            .FirstOrDefaultAsync(g => g.Id == groupId, cancellationToken);

        if (group is null)
        {
            return await ListAsync(cancellationToken);
        }

        var keep = group.Files.FirstOrDefault(f => f.Id == fileId);
        if (keep is not null)
        {
            var remove = group.Files.Where(f => f.Id != fileId).ToList();
            db.DuplicateFiles.RemoveRange(remove);
        }

        db.DuplicateGroups.Remove(group);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Duplicates",
            EventType = "Resolved",
            Message = $"Duplicate group resolved (keep {fileId})",
            EntityType = "DuplicateGroup",
            EntityId = groupId,
        }, cancellationToken);

        return await ListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<DuplicateGroupDto>> KeepBothAsync(
        string groupId,
        CancellationToken cancellationToken = default)
    {
        var group = await db.DuplicateGroups
            .Include(g => g.Files)
            .FirstOrDefaultAsync(g => g.Id == groupId, cancellationToken);

        if (group is not null)
        {
            db.DuplicateGroups.Remove(group);
            await db.SaveChangesAsync(cancellationToken);

            await eventLogger.WriteAsync(new AppLogEvent
            {
                Category = "Duplicates",
                EventType = "Resolved",
                Message = $"Duplicate group resolved (keep both)",
                EntityType = "DuplicateGroup",
                EntityId = groupId,
            }, cancellationToken);
        }

        return await ListAsync(cancellationToken);
    }
}

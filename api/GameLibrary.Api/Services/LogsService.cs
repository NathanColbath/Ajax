using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Mapping;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Services;

public class LogsService(AppDbContext db)
{
    public async Task<IReadOnlyList<LogEntryDto>> QueryAsync(
        LogQueryDto query,
        CancellationToken cancellationToken = default)
    {
        var limit = Math.Clamp(query.Limit ?? 100, 1, 500);
        var q = db.LogEntries.AsNoTracking().AsQueryable();

        if (query.AfterId is long afterId)
        {
            q = q.Where(e => e.Id > afterId);
        }

        if (query.Since is DateTimeOffset since)
        {
            q = q.Where(e => e.Timestamp >= since);
        }

        if (!string.IsNullOrWhiteSpace(query.Level))
        {
            q = q.Where(e => e.Level == query.Level);
        }

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            q = q.Where(e => e.Category == query.Category);
        }

        if (!string.IsNullOrWhiteSpace(query.CorrelationId))
        {
            q = q.Where(e => e.CorrelationId == query.CorrelationId);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            q = q.Where(e =>
                e.Message.Contains(term)
                || (e.RequestPath != null && e.RequestPath.Contains(term))
                || (e.EventType != null && e.EventType.Contains(term)));
        }

        var rows = await q
            .OrderByDescending(e => e.Id)
            .Take(limit)
            .ToListAsync(cancellationToken);

        // For afterId polling, return ascending so UI can append chronologically
        if (query.AfterId is not null)
        {
            rows.Reverse();
        }

        return rows.Select(EntityMappers.ToDto).ToList();
    }

    public async Task<LogEntryDto?> GetByIdAsync(long id, CancellationToken cancellationToken = default)
    {
        var entry = await db.LogEntries.AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
        return entry is null ? null : EntityMappers.ToDto(entry);
    }

    public async Task<int> PurgeAsync(int olderThanDays, CancellationToken cancellationToken = default)
    {
        var cutoff = DateTimeOffset.UtcNow.AddDays(-Math.Max(1, olderThanDays));
        var old = await db.LogEntries.Where(e => e.Timestamp < cutoff).ToListAsync(cancellationToken);
        db.LogEntries.RemoveRange(old);
        await db.SaveChangesAsync(cancellationToken);
        return old.Count;
    }

    public async Task<DeleteStatus> DeleteAsync(long id, CancellationToken cancellationToken = default)
    {
        var entry = await db.LogEntries.FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
        if (entry is null)
        {
            return DeleteStatus.NotFound();
        }

        db.LogEntries.Remove(entry);
        await db.SaveChangesAsync(cancellationToken);
        return DeleteStatus.Ok();
    }
}

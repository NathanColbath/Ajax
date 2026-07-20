using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Entities;
using GameLibrary.Api.Engines;
using GameLibrary.Api.Jobs;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Services;

public class PublicEnrichmentService(
    AppDbContext db,
    IBackgroundJobQueue jobQueue,
    IAppEventLogger eventLogger,
    ILogger<PublicEnrichmentService> logger)
{
    public async Task<PublicEnrichmentStatusDto> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        var state = await EnsureStateAsync(cancellationToken);
        return ToDto(state);
    }

    public async Task<PublicEnrichmentStatusDto> RunAsync(CancellationToken cancellationToken = default)
    {
        var state = await EnsureStateAsync(cancellationToken);
        if (string.Equals(state.Status, "running", StringComparison.OrdinalIgnoreCase))
        {
            return ToDto(state);
        }

        state.Status = "running";
        state.LastRunLabel = "Running…";
        state.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Metadata",
            EventType = "PublicEnrichmentStarted",
            Message = "DeepSeek public enrichment started",
            EntityType = "PublicEnrichmentState",
            EntityId = PublicEnrichmentState.DefaultId,
        }, cancellationToken);

        logger.LogInformation("Enqueueing public enrichment background job.");

        await jobQueue.QueueBackgroundWorkItemAsync(new BackgroundWorkItem
        {
            JobType = "public-enrichment",
            Work = async (sp, ct) =>
            {
                var engine = sp.GetRequiredService<PublicEnrichmentEngine>();
                try
                {
                    await engine.RunAsync(ct);
                }
                catch (Exception ex)
                {
                    sp.GetRequiredService<ILogger<PublicEnrichmentService>>()
                        .LogError(ex, "Public enrichment job failed.");
                    await engine.MarkFailedAsync(ex.Message, ct);
                    throw;
                }
            },
        }, cancellationToken);

        return ToDto(state);
    }

    private async Task<PublicEnrichmentState> EnsureStateAsync(CancellationToken cancellationToken)
    {
        var state = await db.PublicEnrichmentStates
            .FirstOrDefaultAsync(s => s.Id == PublicEnrichmentState.DefaultId, cancellationToken);
        if (state is not null)
        {
            return state;
        }

        state = new PublicEnrichmentState
        {
            Id = PublicEnrichmentState.DefaultId,
            Status = "idle",
            LastRunLabel = "Never",
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.PublicEnrichmentStates.Add(state);
        await db.SaveChangesAsync(cancellationToken);
        return state;
    }

    private static PublicEnrichmentStatusDto ToDto(PublicEnrichmentState state) =>
        new(state.Status, state.LastRunLabel, state.UpdatedAt);
}

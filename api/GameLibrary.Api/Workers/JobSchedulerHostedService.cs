using GameLibrary.Api.Data;
using GameLibrary.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Workers;

/// <summary>
/// Enqueues scheduled metadata / enrichment runs when cron (or HH:mm) matches.
/// </summary>
public sealed class JobSchedulerHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<JobSchedulerHostedService> logger) : BackgroundService
{
    private string? _lastMetadataKey;
    private string? _lastEnrichmentKey;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Job scheduler started.");
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var now = DateTimeOffset.UtcNow;
                using var scope = scopeFactory.CreateScope();
                var configService = scope.ServiceProvider.GetRequiredService<ConfigService>();
                var config = await configService.GetOrCreateConfigAsync(stoppingToken);

                if (!configService.ResolveBackgroundJobsEnabled(config))
                {
                    await Task.Delay(30_000, stoppingToken);
                    continue;
                }

                var metaKey = $"{now:yyyyMMddHHmm}-meta";
                if (JobSchedule.CronMatchesNow(config.ScheduledMetadataCron, now, config.JobTimeZoneId)
                    && metaKey != _lastMetadataKey)
                {
                    _lastMetadataKey = metaKey;
                    await EnqueueMetadataAsync(scope.ServiceProvider, stoppingToken);
                }

                var enrichKey = $"{now:yyyyMMddHHmm}-enrich";
                if (JobSchedule.CronMatchesNow(config.ScheduledEnrichmentCron, now, config.JobTimeZoneId)
                    && enrichKey != _lastEnrichmentKey)
                {
                    _lastEnrichmentKey = enrichKey;
                    await EnqueueEnrichmentAsync(scope.ServiceProvider, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Job scheduler tick failed.");
            }

            await Task.Delay(30_000, stoppingToken);
        }

        logger.LogInformation("Job scheduler stopped.");
    }

    private async Task EnqueueMetadataAsync(IServiceProvider sp, CancellationToken ct)
    {
        var db = sp.GetRequiredService<AppDbContext>();
        var provider = await db.MetadataProviders.FirstOrDefaultAsync(p => p.Id == "hasheous", ct);
        if (provider is null || !provider.Enabled)
        {
            return;
        }

        if (provider.Status == "running")
        {
            return;
        }

        logger.LogInformation("Scheduler enqueueing metadata provider hasheous.");
        var metadata = sp.GetRequiredService<MetadataService>();
        await metadata.RunProviderAsync("hasheous", ct);
    }

    private async Task EnqueueEnrichmentAsync(IServiceProvider sp, CancellationToken ct)
    {
        logger.LogInformation("Scheduler enqueueing public enrichment.");
        var enrichment = sp.GetRequiredService<PublicEnrichmentService>();
        await enrichment.RunAsync(ct);
    }
}

using GameLibrary.Api.Services;

namespace GameLibrary.Api.Workers;

public sealed class JobRecoveryHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<JobRecoveryHostedService> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var uploads = scope.ServiceProvider.GetRequiredService<UploadsService>();
        var exports = scope.ServiceProvider.GetRequiredService<ExportsService>();
        var lists = scope.ServiceProvider.GetRequiredService<GameListsService>();
        var metadata = scope.ServiceProvider.GetRequiredService<MetadataService>();
        var eventLogger = scope.ServiceProvider.GetRequiredService<IAppEventLogger>();

        logger.LogInformation("Recovering interrupted background jobs.");

        var uploadCount = await uploads.RecoverActiveJobsAsync(cancellationToken);
        var exportCount = await exports.RecoverActiveJobsAsync(cancellationToken);
        var listZipCount = await lists.RecoverActiveJobsAsync(cancellationToken);
        var metadataCount = await metadata.RecoverActiveProvidersAsync(cancellationToken);
        var total = uploadCount + exportCount + listZipCount + metadataCount;

        if (total > 0)
        {
            await eventLogger.WriteAsync(new AppLogEvent
            {
                Category = "Worker",
                EventType = "JobsRecovered",
                Message = $"Recovered {total} background job(s) (uploads={uploadCount}, exports={exportCount}, listZips={listZipCount}, metadata={metadataCount})",
            }, cancellationToken);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

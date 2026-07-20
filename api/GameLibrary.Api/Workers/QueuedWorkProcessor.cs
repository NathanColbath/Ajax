using GameLibrary.Api.Data;
using GameLibrary.Api.Jobs;
using GameLibrary.Api.Services;

namespace GameLibrary.Api.Workers;

public sealed class QueuedWorkProcessor(
    IBackgroundJobQueue queue,
    IServiceScopeFactory scopeFactory,
    ILogger<QueuedWorkProcessor> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Queued work processor started.");
        var running = new List<Task>();
        SemaphoreSlim? uploadGate = null;
        var lastParallel = -1;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                running.RemoveAll(t => t.IsCompleted);

                using (var scope = scopeFactory.CreateScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var configService = scope.ServiceProvider.GetRequiredService<ConfigService>();
                    var config = await configService.GetOrCreateConfigAsync(stoppingToken);
                    var parallel = configService.ResolveMaxParallelUploads(config);
                    if (uploadGate is null || lastParallel != parallel)
                    {
                        uploadGate?.Dispose();
                        uploadGate = new SemaphoreSlim(parallel, parallel);
                        lastParallel = parallel;
                    }

                    if (!configService.ResolveBackgroundJobsEnabled(config))
                    {
                        await Task.Delay(2000, stoppingToken);
                        continue;
                    }
                }

                var workItem = await queue.DequeueAsync(stoppingToken);

                using (var gateScope = scopeFactory.CreateScope())
                {
                    var configService = gateScope.ServiceProvider.GetRequiredService<ConfigService>();
                    var config = await configService.GetOrCreateConfigAsync(stoppingToken);
                    if (!JobSchedule.CanStartJob(config, workItem.JobType, DateTimeOffset.UtcNow))
                    {
                        await queue.QueueBackgroundWorkItemAsync(workItem, stoppingToken);
                        await Task.Delay(3000, stoppingToken);
                        continue;
                    }
                }

                if (string.Equals(workItem.JobType, "upload", StringComparison.OrdinalIgnoreCase))
                {
                    var gate = uploadGate!;
                    var task = Task.Run(
                        async () =>
                        {
                            await gate.WaitAsync(stoppingToken);
                            try
                            {
                                await ProcessAsync(workItem, stoppingToken);
                            }
                            finally
                            {
                                gate.Release();
                            }
                        },
                        stoppingToken);
                    running.Add(task);
                }
                else
                {
                    await ProcessAsync(workItem, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Queued work processor loop error.");
                await Task.Delay(1000, stoppingToken);
            }
        }

        try
        {
            await Task.WhenAll(running);
        }
        catch
        {
            // ignored on shutdown
        }

        uploadGate?.Dispose();
        logger.LogInformation("Queued work processor stopped.");
    }

    private async Task ProcessAsync(BackgroundWorkItem workItem, CancellationToken stoppingToken)
    {
        var startedAt = DateTimeOffset.UtcNow;
        int maxMinutes = 60;
        try
        {
            using var scope = scopeFactory.CreateScope();
            var configService = scope.ServiceProvider.GetRequiredService<ConfigService>();
            var config = await configService.GetOrCreateConfigAsync(stoppingToken);
            maxMinutes = Math.Max(1, config.MaxJobRuntimeMinutes);
            var eventLogger = scope.ServiceProvider.GetRequiredService<IAppEventLogger>();

            await eventLogger.WriteAsync(new AppLogEvent
            {
                Category = "Worker",
                EventType = "JobStarted",
                Message = $"Background job started: {workItem.JobType}",
            }, stoppingToken);

            logger.LogInformation("Processing background job {JobType}.", workItem.JobType);

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            timeoutCts.CancelAfter(TimeSpan.FromMinutes(maxMinutes));

            await workItem.Work(scope.ServiceProvider, timeoutCts.Token);

            var elapsed = DateTimeOffset.UtcNow - startedAt;
            logger.LogInformation(
                "Background job completed: {JobType} in {ElapsedMs}ms.",
                workItem.JobType,
                (int)elapsed.TotalMilliseconds);

            await eventLogger.WriteAsync(new AppLogEvent
            {
                Category = "Worker",
                EventType = "JobCompleted",
                Message = $"Background job completed: {workItem.JobType} ({(int)elapsed.TotalMilliseconds}ms)",
            }, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning(
                "Background job {JobType} exceeded max runtime of {Minutes} minutes.",
                workItem.JobType,
                maxMinutes);
            try
            {
                using var scope = scopeFactory.CreateScope();
                var eventLogger = scope.ServiceProvider.GetRequiredService<IAppEventLogger>();
                await eventLogger.WriteAsync(new AppLogEvent
                {
                    Level = "Warning",
                    Category = "Worker",
                    EventType = "JobTimeout",
                    Message = $"Background job timed out: {workItem.JobType} (max {maxMinutes}m)",
                }, CancellationToken.None);
            }
            catch
            {
                // ignore
            }
        }
        catch (Exception ex)
        {
            var elapsed = DateTimeOffset.UtcNow - startedAt;
            logger.LogError(
                ex,
                "Background job failed: {JobType} after {ElapsedMs}ms.",
                workItem.JobType,
                (int)elapsed.TotalMilliseconds);

            try
            {
                using var scope = scopeFactory.CreateScope();
                var eventLogger = scope.ServiceProvider.GetRequiredService<IAppEventLogger>();
                await eventLogger.WriteAsync(new AppLogEvent
                {
                    Level = "Error",
                    Category = "Worker",
                    EventType = "JobFailed",
                    Message = $"Background job failed: {workItem.JobType}",
                    Exception = ex.ToString(),
                }, stoppingToken);
            }
            catch (Exception logEx)
            {
                logger.LogError(logEx, "Failed to log background job failure.");
            }
        }
    }
}

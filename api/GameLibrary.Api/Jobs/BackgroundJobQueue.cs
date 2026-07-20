using System.Threading.Channels;

namespace GameLibrary.Api.Jobs;

public sealed class BackgroundJobQueue : IBackgroundJobQueue
{
    private readonly Channel<BackgroundWorkItem> _queue = Channel.CreateUnbounded<BackgroundWorkItem>(
        new UnboundedChannelOptions
        {
            SingleReader = false,
            SingleWriter = false,
        });

    private readonly ILogger<BackgroundJobQueue> _logger;
    private int _queuedCount;

    public BackgroundJobQueue(ILogger<BackgroundJobQueue> logger)
    {
        _logger = logger;
    }

    public int PendingCount => Volatile.Read(ref _queuedCount);

    public async ValueTask QueueBackgroundWorkItemAsync(
        BackgroundWorkItem workItem,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(workItem);
        await _queue.Writer.WriteAsync(workItem, cancellationToken);
        var pending = Interlocked.Increment(ref _queuedCount);
        _logger.LogInformation(
            "Background job enqueued: {JobType} (pending={Pending}).",
            workItem.JobType,
            pending);
    }

    public async ValueTask<BackgroundWorkItem> DequeueAsync(CancellationToken cancellationToken)
    {
        var workItem = await _queue.Reader.ReadAsync(cancellationToken);
        var pending = Interlocked.Decrement(ref _queuedCount);
        _logger.LogInformation(
            "Background job dequeued: {JobType} (pending={Pending}).",
            workItem.JobType,
            Math.Max(0, pending));
        return workItem;
    }
}

public static class BackgroundJobQueueExtensions
{
    public static IServiceCollection AddBackgroundJobQueue(this IServiceCollection services)
    {
        services.AddSingleton<IBackgroundJobQueue, BackgroundJobQueue>();
        return services;
    }
}

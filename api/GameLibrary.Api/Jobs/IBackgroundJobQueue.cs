namespace GameLibrary.Api.Jobs;

public interface IBackgroundJobQueue
{
    ValueTask QueueBackgroundWorkItemAsync(
        BackgroundWorkItem workItem,
        CancellationToken cancellationToken = default);

    ValueTask<BackgroundWorkItem> DequeueAsync(CancellationToken cancellationToken);
}

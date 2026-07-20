namespace GameLibrary.Api.Jobs;

public sealed class BackgroundWorkItem
{
    public required string JobType { get; init; }
    public required Func<IServiceProvider, CancellationToken, Task> Work { get; init; }
}

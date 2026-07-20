namespace GameLibrary.Api.Entities;

public class BackgroundJob
{
    public string Id { get; set; } = string.Empty;
    public string JobType { get; set; } = string.Empty;
    public string Status { get; set; } = "queued";
    public string? PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public string? ErrorMessage { get; set; }
}

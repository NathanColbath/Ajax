namespace GameLibrary.Api.Entities;

public class GameListDownloadJob
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string ListId { get; set; } = string.Empty;
    public string ListName { get; set; } = string.Empty;
    public string Status { get; set; } = "queued";
    public int Progress { get; set; }
    public string? FilePath { get; set; }
    public string? FileName { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}

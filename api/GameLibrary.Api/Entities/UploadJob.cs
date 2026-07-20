namespace GameLibrary.Api.Entities;

public class UploadJob
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public long Size { get; set; }
    public int Progress { get; set; }
    public string State { get; set; } = "queued";
    public string? SystemId { get; set; }
    public string? GameId { get; set; }
    public string? CreateTitle { get; set; }
    public string? BackgroundJobId { get; set; }
    public string? Message { get; set; }
    public string? StoragePath { get; set; }
    public string? ContentHash { get; set; }
}

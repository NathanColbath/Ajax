namespace GameLibrary.Api.Entities;

public class ExportJob
{
    public string Id { get; set; } = string.Empty;
    public string Format { get; set; } = string.Empty;
    public List<string> Scopes { get; set; } = [];
    public string Status { get; set; } = "queued";
    public string CreatedLabel { get; set; } = string.Empty;
    public string? StoragePath { get; set; }
    public string? FileName { get; set; }
}

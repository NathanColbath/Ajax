namespace GameLibrary.Api.Entities;

public class MetadataProvider
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool Enabled { get; set; }
    public string LastRunLabel { get; set; } = string.Empty;
    public string Status { get; set; } = "idle";
}

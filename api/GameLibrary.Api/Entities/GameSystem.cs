namespace GameLibrary.Api.Entities;

public class GameSystem
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string ShortName { get; set; } = string.Empty;
    public string Manufacturer { get; set; } = string.Empty;
    public List<string> Extensions { get; set; } = [];
    public int GameCount { get; set; }
    public string Icon { get; set; } = string.Empty;
    public string Accent { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ReleasePeriod { get; set; } = string.Empty;
    public string Generation { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public string LogoPath { get; set; } = string.Empty;
    public string PreferredStoragePath { get; set; } = string.Empty;
    public Dictionary<string, string> MetadataProviderIds { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public string EmulatorInfo { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
}


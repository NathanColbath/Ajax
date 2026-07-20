namespace GameLibrary.Api.Entities;

public class PhysicalLocation
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string? Notes { get; set; }

    public ICollection<PhysicalItem> Items { get; set; } = [];
}

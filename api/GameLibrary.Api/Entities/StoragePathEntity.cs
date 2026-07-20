namespace GameLibrary.Api.Entities;

public class StoragePathEntity
{
    public string Id { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public double UsedGb { get; set; }
    public double TotalGb { get; set; }
    public string Health { get; set; } = "ok";
}

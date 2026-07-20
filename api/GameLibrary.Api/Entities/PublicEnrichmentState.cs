namespace GameLibrary.Api.Entities;

public class PublicEnrichmentState
{
    public const string DefaultId = "default";

    public string Id { get; set; } = DefaultId;
    public string Status { get; set; } = "idle";
    public string LastRunLabel { get; set; } = "Never";
    public DateTimeOffset UpdatedAt { get; set; }
}

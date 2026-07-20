namespace GameLibrary.Api.Entities;

public class MetadataReviewItem
{
    public string Id { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string SuggestedTitle { get; set; } = string.Empty;
    public string System { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public string GameId { get; set; } = string.Empty;
    public string ProviderId { get; set; } = string.Empty;
    public string SuggestedCoverUrl { get; set; } = string.Empty;
    public string SuggestedFieldsJson { get; set; } = string.Empty;
}

namespace GameLibrary.Api.Services;

public class DeepSeekOptions
{
    public const string SectionName = "DeepSeek";

    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.deepseek.com";
    public string Model { get; set; } = "deepseek-chat";
}

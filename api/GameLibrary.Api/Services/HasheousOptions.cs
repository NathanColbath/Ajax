namespace GameLibrary.Api.Services;

public class HasheousOptions
{
    public const string SectionName = "Hasheous";

    public string BaseUri { get; set; } = "https://hasheous.org/";
    public string ApiKey { get; set; } = string.Empty;
}


namespace GameLibrary.Api.Entities;

public class GameFile
{
    public string Id { get; set; } = string.Empty;
    public string GameId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string SizeLabel { get; set; } = string.Empty;
    public string Extension { get; set; } = string.Empty;
    public string? StoragePath { get; set; }
    /// <summary>SHA-256 hex — used for local duplicate detection.</summary>
    public string? ContentHash { get; set; }
    /// <summary>MD5 hex — primary Hasheous lookup key.</summary>
    public string? Md5Hash { get; set; }
    /// <summary>SHA-1 hex — secondary Hasheous lookup key.</summary>
    public string? Sha1Hash { get; set; }

    public Game? Game { get; set; }
}

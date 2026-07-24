namespace GameLibrary.Api.Entities;

public class Game
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string System { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public int Year { get; set; }
    public bool Owned { get; set; }
    /// <summary>
    /// True when this catalog row exists only to back a physical item (no digital library presence).
    /// Cleared when ROM files are attached.
    /// </summary>
    public bool IsPhysicalOnly { get; set; }
    public bool HasArt { get; set; }
    public string Accent { get; set; } = string.Empty;
    public double Rating { get; set; }
    public int RatingCount { get; set; }
    public int DownloadCount { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string Description { get; set; } = string.Empty;
    public string Publisher { get; set; } = string.Empty;
    public string Developer { get; set; } = string.Empty;
    public string ReleaseDate { get; set; } = string.Empty;
    public string Players { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public string CoverPath { get; set; } = string.Empty;
    public string MetadataSource { get; set; } = string.Empty;
    public string ExternalId { get; set; } = string.Empty;
    public List<string> Genres { get; set; } = [];
    public List<string> Tags { get; set; } = [];
    public List<string> Languages { get; set; } = [];
    public List<string> Screenshots { get; set; } = [];

    /// <summary>AI/public enrichment score (typically 0–100).</summary>
    public double? PublicRating { get; set; }
    public int? PublicRatingsCount { get; set; }
    public int? PublicCriticScore { get; set; }
    public string PublicRatingProvider { get; set; } = string.Empty;
    public int PublicRatingScale { get; set; } = 100;

    public ICollection<GameFile> Files { get; set; } = [];
    public ICollection<UserGameState> UserStates { get; set; } = [];
}


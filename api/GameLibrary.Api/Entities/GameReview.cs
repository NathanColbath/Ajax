namespace GameLibrary.Api.Entities;

public class GameReview
{
    public string Id { get; set; } = string.Empty;
    public string GameId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public int Rating { get; set; }
    public string Body { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Game? Game { get; set; }
    public AppUser? User { get; set; }
}

namespace GameLibrary.Api.Entities;

public class UserGameState
{
    public string UserId { get; set; } = string.Empty;
    public string GameId { get; set; } = string.Empty;
    public bool Favorite { get; set; }
    public string PlayStatus { get; set; } = "unplayed";

    public AppUser? User { get; set; }
    public Game? Game { get; set; }
}

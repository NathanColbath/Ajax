namespace GameLibrary.Api.Entities;

public class UserGameListItem
{
    public string Id { get; set; } = string.Empty;
    public string ListId { get; set; } = string.Empty;
    public string GameId { get; set; } = string.Empty;
    public DateTimeOffset AddedAt { get; set; }

    public UserGameList? List { get; set; }
    public Game? Game { get; set; }
}

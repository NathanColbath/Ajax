namespace GameLibrary.Api.Entities;

public class GameCuratedReview
{
    public string Id { get; set; } = string.Empty;
    public string GameId { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Provider { get; set; } = "deepseek";
    public DateTimeOffset CreatedAt { get; set; }

    public Game? Game { get; set; }
}

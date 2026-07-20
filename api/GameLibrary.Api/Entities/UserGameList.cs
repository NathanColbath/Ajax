namespace GameLibrary.Api.Entities;

public class UserGameList
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public AppUser? User { get; set; }
    public ICollection<UserGameListItem> Items { get; set; } = [];
}

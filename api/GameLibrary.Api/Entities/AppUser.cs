namespace GameLibrary.Api.Entities;

public class AppUser
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "standard";
    public bool Enabled { get; set; } = true;
    public string Initials { get; set; } = string.Empty;

    public ICollection<UserGameState> GameStates { get; set; } = [];
}

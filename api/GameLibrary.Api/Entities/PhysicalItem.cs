namespace GameLibrary.Api.Entities;

public class PhysicalItem
{
    public string Id { get; set; } = string.Empty;
    public string? GameId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string System { get; set; } = string.Empty;
    public string Condition { get; set; } = string.Empty;
    public string LocationId { get; set; } = string.Empty;
    public string Completeness { get; set; } = string.Empty;
    public bool CheckedOut { get; set; }
    public string? Borrower { get; set; }
    public string Accent { get; set; } = string.Empty;

    public PhysicalLocation? Location { get; set; }
    public Game? Game { get; set; }
}

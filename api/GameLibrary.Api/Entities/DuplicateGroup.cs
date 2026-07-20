namespace GameLibrary.Api.Entities;

public class DuplicateGroup
{
    public string Id { get; set; } = string.Empty;
    public string Hash { get; set; } = string.Empty;

    public ICollection<DuplicateFile> Files { get; set; } = [];
}

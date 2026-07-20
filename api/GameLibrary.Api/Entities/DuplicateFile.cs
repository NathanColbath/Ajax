namespace GameLibrary.Api.Entities;

public class DuplicateFile
{
    public string Id { get; set; } = string.Empty;
    public string DuplicateGroupId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string SizeLabel { get; set; } = string.Empty;
    public string System { get; set; } = string.Empty;

    public DuplicateGroup? DuplicateGroup { get; set; }
}

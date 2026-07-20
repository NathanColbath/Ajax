namespace GameLibrary.Api.Services;

public class StorageOptions
{
    public const string SectionName = "Storage";

    public string RootPath { get; set; } = "../data/files";
}

namespace GameLibrary.Api.Services;

public readonly record struct DeleteStatus(
    bool Found,
    bool Conflict = false,
    bool BadRequest = false,
    string? Message = null)
{
    public static DeleteStatus NotFound() => new(Found: false);

    public static DeleteStatus Ok() => new(Found: true);

    public static DeleteStatus Conflicted(string message) =>
        new(Found: true, Conflict: true, Message: message);

    public static DeleteStatus Invalid(string message) =>
        new(Found: true, BadRequest: true, Message: message);
}

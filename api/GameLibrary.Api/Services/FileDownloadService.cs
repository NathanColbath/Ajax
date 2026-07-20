using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;

namespace GameLibrary.Api.Services;

public class FileDownloadService(FileStorageService fileStorage)
{
    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    public FileStreamResult? OpenAttachment(string? storagePath, string downloadFileName)
    {
        if (!fileStorage.TryOpenRead(storagePath, out var stream) || stream is null)
        {
            return null;
        }

        return new FileStreamResult(stream, "application/octet-stream")
        {
            FileDownloadName = downloadFileName,
            EnableRangeProcessing = true,
        };
    }

    public FileStreamResult? OpenImage(string? storagePath)
    {
        if (!fileStorage.TryOpenRead(storagePath, out var stream) || stream is null)
        {
            return null;
        }

        var fileName = Path.GetFileName(storagePath) ?? "image";
        if (!ContentTypes.TryGetContentType(fileName, out var contentType))
        {
            contentType = "application/octet-stream";
        }

        return new FileStreamResult(stream, contentType)
        {
            EnableRangeProcessing = true,
        };
    }
}

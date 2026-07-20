using System.Security.Cryptography;

namespace GameLibrary.Api.Services;

public readonly record struct FileHashes(string Sha256, string Md5, string Sha1);

public static class FileHashUtility
{
    public static async Task<FileHashes> ComputeAllAsync(
        string filePath,
        CancellationToken cancellationToken = default)
    {
        await using var stream = File.OpenRead(filePath);
        using var sha256 = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        using var md5 = IncrementalHash.CreateHash(HashAlgorithmName.MD5);
        using var sha1 = IncrementalHash.CreateHash(HashAlgorithmName.SHA1);

        var buffer = new byte[1024 * 80];
        int read;
        while ((read = await stream.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken)) > 0)
        {
            sha256.AppendData(buffer.AsSpan(0, read));
            md5.AppendData(buffer.AsSpan(0, read));
            sha1.AppendData(buffer.AsSpan(0, read));
        }

        return new FileHashes(
            Convert.ToHexString(sha256.GetHashAndReset()).ToLowerInvariant(),
            Convert.ToHexString(md5.GetHashAndReset()).ToLowerInvariant(),
            Convert.ToHexString(sha1.GetHashAndReset()).ToLowerInvariant());
    }
}

using Microsoft.Extensions.Options;

namespace GameLibrary.Api.Services;

public class FileStorageService(IOptions<StorageOptions> storageOptions)
{
    private static readonly string[] KnownBuckets =
    [
        "library",
        "uploads",
        "exports",
        "list-exports",
        "artwork",
    ];

    public string RootPath => Path.GetFullPath(storageOptions.Value.RootPath);

    public void EnsureRoot() => Directory.CreateDirectory(RootPath);

    public string GetUploadDir(string jobId)
    {
        var path = Path.Combine(RootPath, "uploads", SanitizeSegment(jobId));
        Directory.CreateDirectory(path);
        return path;
    }

    public string GetLibraryDir(string gameId)
    {
        var path = Path.Combine(RootPath, "library", SanitizeSegment(gameId));
        Directory.CreateDirectory(path);
        return path;
    }

    public string GetExportsDir()
    {
        var path = Path.Combine(RootPath, "exports");
        Directory.CreateDirectory(path);
        return path;
    }

    /// <summary>
    /// Returns artwork directory for games or systems: {root}/artwork/{games|systems}/{id}/
    /// </summary>
    public string GetArtworkDir(string entityType, string entityId)
    {
        var type = SanitizeSegment(entityType).ToLowerInvariant();
        if (type is not ("games" or "systems"))
        {
            throw new ArgumentException("entityType must be 'games' or 'systems'.", nameof(entityType));
        }

        var path = Path.Combine(RootPath, "artwork", type, SanitizeSegment(entityId));
        Directory.CreateDirectory(path);
        return path;
    }

    public string CombineUnderRoot(params string[] parts)
    {
        var combined = Path.GetFullPath(Path.Combine(new[] { RootPath }.Concat(parts).ToArray()));
        if (!combined.StartsWith(RootPath, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Path escapes storage root.");
        }

        return combined;
    }

    public bool TryOpenRead(string? absolutePath, out FileStream? stream)
    {
        stream = null;
        if (string.IsNullOrWhiteSpace(absolutePath) || !File.Exists(absolutePath))
        {
            return false;
        }

        var full = Path.GetFullPath(absolutePath);
        if (!full.StartsWith(RootPath, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        stream = File.OpenRead(full);
        return true;
    }

    public void TryDeleteFile(string? absolutePath)
    {
        if (string.IsNullOrWhiteSpace(absolutePath))
        {
            return;
        }

        try
        {
            var full = Path.GetFullPath(absolutePath);
            if (full.StartsWith(RootPath, StringComparison.OrdinalIgnoreCase) && File.Exists(full))
            {
                File.Delete(full);
            }
        }
        catch
        {
            // best-effort cleanup
        }
    }

    /// <summary>
    /// Best-effort recursive directory delete when the path is under the storage root.
    /// </summary>
    public void TryDeleteDirectory(string? absolutePath)
    {
        if (string.IsNullOrWhiteSpace(absolutePath))
        {
            return;
        }

        try
        {
            var full = Path.GetFullPath(absolutePath);
            if (!full.StartsWith(RootPath, StringComparison.OrdinalIgnoreCase)
                || string.Equals(full, RootPath, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (Directory.Exists(full))
            {
                Directory.Delete(full, recursive: true);
            }
        }
        catch
        {
            // best-effort cleanup
        }
    }

    public string GetLibraryDirPath(string gameId) =>
        Path.Combine(RootPath, "library", SanitizeSegment(gameId));

    public string GetArtworkDirPath(string entityType, string entityId)
    {
        var type = SanitizeSegment(entityType).ToLowerInvariant();
        return Path.Combine(RootPath, "artwork", type, SanitizeSegment(entityId));
    }

    public string GetUploadDirPath(string jobId) =>
        Path.Combine(RootPath, "uploads", SanitizeSegment(jobId));

    /// <summary>
    /// Live disk usage for the configured storage root and its volume.
    /// Used = bytes under RootPath; Total/Free = volume capacity via DriveInfo.
    /// </summary>
    public StorageUsageSnapshot GetUsageSnapshot()
    {
        EnsureRoot();
        var root = RootPath;
        var usedBytes = GetDirectorySizeBytes(root);

        double totalGb = 0;
        double freeGb = 0;
        try
        {
            var rootPathName = Path.GetPathRoot(root);
            if (!string.IsNullOrWhiteSpace(rootPathName))
            {
                var drive = new DriveInfo(rootPathName);
                if (drive.IsReady)
                {
                    totalGb = BytesToGb(drive.TotalSize);
                    freeGb = BytesToGb(drive.AvailableFreeSpace);
                }
            }
        }
        catch
        {
            // leave total/free at 0 when volume info is unavailable
        }

        if (totalGb <= 0)
        {
            // Fallback when DriveInfo fails (unusual mounts): treat used as both used and total.
            totalGb = Math.Max(BytesToGb(usedBytes), 0.01);
            freeGb = 0;
        }

        var health = VolumeHealth(freeGb, totalGb);
        var paths = new List<StoragePathUsage>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var bucket in KnownBuckets)
        {
            var dir = Path.Combine(root, bucket);
            seen.Add(dir);
            var size = Directory.Exists(dir) ? GetDirectorySizeBytes(dir) : 0L;
            paths.Add(new StoragePathUsage(dir, BytesToGb(size), totalGb, health));
        }

        if (Directory.Exists(root))
        {
            foreach (var dir in Directory.EnumerateDirectories(root))
            {
                if (!seen.Add(dir))
                {
                    continue;
                }

                paths.Add(new StoragePathUsage(dir, BytesToGb(GetDirectorySizeBytes(dir)), totalGb, health));
            }
        }

        paths.Sort((a, b) => string.Compare(a.Path, b.Path, StringComparison.OrdinalIgnoreCase));

        return new StorageUsageSnapshot(BytesToGb(usedBytes), totalGb, freeGb, paths);
    }

    /// <summary>
    /// Deletes all files and subdirectories under the storage root, then recreates an empty root.
    /// </summary>
    public void ClearAllContents()
    {
        EnsureRoot();
        var root = RootPath;

        foreach (var entry in Directory.EnumerateFileSystemEntries(root))
        {
            try
            {
                if (Directory.Exists(entry))
                {
                    Directory.Delete(entry, recursive: true);
                }
                else if (File.Exists(entry))
                {
                    File.Delete(entry);
                }
            }
            catch
            {
                // best-effort; continue clearing other entries
            }
        }

        Directory.CreateDirectory(Path.Combine(root, "uploads"));
        Directory.CreateDirectory(Path.Combine(root, "library"));
        Directory.CreateDirectory(Path.Combine(root, "exports"));
        Directory.CreateDirectory(Path.Combine(root, "list-exports"));
        Directory.CreateDirectory(Path.Combine(root, "artwork"));
    }

    public static string SanitizeFileName(string name) =>
        Path.GetFileName(name.Replace('\0', '_'));

    private static long GetDirectorySizeBytes(string path)
    {
        if (!Directory.Exists(path))
        {
            return 0;
        }

        long total = 0;
        try
        {
            foreach (var file in Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories))
            {
                try
                {
                    total += new FileInfo(file).Length;
                }
                catch
                {
                    // skip inaccessible files
                }
            }
        }
        catch
        {
            // skip inaccessible trees
        }

        return total;
    }

    private static double BytesToGb(long bytes) =>
        Math.Round(bytes / (1024d * 1024d * 1024d), 3);

    private static string VolumeHealth(double freeGb, double totalGb)
    {
        if (totalGb <= 0)
        {
            return "warning";
        }

        var freeRatio = freeGb / totalGb;
        if (freeRatio < 0.05)
        {
            return "critical";
        }

        if (freeRatio < 0.15)
        {
            return "warning";
        }

        return "ok";
    }

    private static string SanitizeSegment(string value)
    {
        foreach (var c in Path.GetInvalidFileNameChars())
        {
            value = value.Replace(c, '_');
        }

        return value;
    }
}

public sealed record StorageUsageSnapshot(
    double UsedGb,
    double TotalGb,
    double FreeGb,
    IReadOnlyList<StoragePathUsage> Paths);

public sealed record StoragePathUsage(
    string Path,
    double UsedGb,
    double TotalGb,
    string Health);

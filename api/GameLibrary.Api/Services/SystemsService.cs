using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Entities;
using GameLibrary.Api.Mapping;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Services;

public class SystemsService(
    AppDbContext db,
    FileDownloadService fileDownload,
    FileStorageService fileStorage,
    ArtworkService artwork,
    IAppEventLogger eventLogger)
{
    public async Task<IReadOnlyList<GameSystemDto>> ListAsync(CancellationToken cancellationToken = default)
    {
        var systems = await db.Systems.OrderBy(s => s.Name).ToListAsync(cancellationToken);
        return systems.Select(EntityMappers.ToDto).ToList();
    }

    public async Task<GameSystemDto> AddAsync(
        CreateGameSystemRequest request,
        CancellationToken cancellationToken = default)
    {
        var system = new GameSystem
        {
            Id = $"s{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            Name = request.Name.Trim(),
            ShortName = request.ShortName.Trim(),
            Manufacturer = request.Manufacturer.Trim(),
            Extensions = request.Extensions.Select(NormalizeExtension).Distinct().ToList(),
            GameCount = 0,
            Icon = request.Icon,
            Accent = request.Accent,
            Description = request.Description?.Trim() ?? string.Empty,
            ReleasePeriod = request.ReleasePeriod?.Trim() ?? string.Empty,
            Generation = request.Generation?.Trim() ?? string.Empty,
            Region = request.Region?.Trim() ?? string.Empty,
            PreferredStoragePath = request.PreferredStoragePath?.Trim() ?? string.Empty,
            MetadataProviderIds = ToProviderIds(request.MetadataProviderIds),
            EmulatorInfo = request.EmulatorInfo?.Trim() ?? string.Empty,
            EmulatorJsCore = ResolveEmulatorJsCore(request.EmulatorJsCore, request.ShortName),
            Status = NormalizeStatus(request.Status),
        };

        db.Systems.Add(system);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Systems",
            EventType = "Created",
            Message = $"System created: {system.Name}",
            EntityType = "System",
            EntityId = system.Id,
        }, cancellationToken);

        return EntityMappers.ToDto(system);
    }

    public async Task<GameSystemDto?> UpdateAsync(
        string id,
        UpdateGameSystemRequest request,
        CancellationToken cancellationToken = default)
    {
        var system = await db.Systems.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (system is null)
        {
            return null;
        }

        if (request.Name is not null)
        {
            system.Name = request.Name.Trim();
        }

        if (request.ShortName is not null)
        {
            system.ShortName = request.ShortName.Trim();
        }

        if (request.Manufacturer is not null)
        {
            system.Manufacturer = request.Manufacturer.Trim();
        }

        if (request.Icon is not null)
        {
            system.Icon = request.Icon;
        }

        if (request.Accent is not null)
        {
            system.Accent = request.Accent;
        }

        if (request.Description is not null)
        {
            system.Description = request.Description;
        }

        if (request.ReleasePeriod is not null)
        {
            system.ReleasePeriod = request.ReleasePeriod.Trim();
        }

        if (request.Generation is not null)
        {
            system.Generation = request.Generation.Trim();
        }

        if (request.Region is not null)
        {
            system.Region = request.Region.Trim();
        }

        if (request.PreferredStoragePath is not null)
        {
            system.PreferredStoragePath = request.PreferredStoragePath.Trim();
        }

        if (request.MetadataProviderIds is not null)
        {
            system.MetadataProviderIds = ToProviderIds(request.MetadataProviderIds);
        }

        if (request.EmulatorInfo is not null)
        {
            system.EmulatorInfo = request.EmulatorInfo;
        }

        if (request.EmulatorJsCore is not null)
        {
            system.EmulatorJsCore = ResolveEmulatorJsCore(request.EmulatorJsCore, system.ShortName);
        }

        if (request.Status is not null)
        {
            system.Status = NormalizeStatus(request.Status);
        }

        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Systems",
            EventType = "Updated",
            Message = $"System updated: {system.Name}",
            EntityType = "System",
            EntityId = system.Id,
        }, cancellationToken);

        return EntityMappers.ToDto(system);
    }

    public async Task<GameSystemDto?> UploadLogoAsync(
        string id,
        IFormFile file,
        CancellationToken cancellationToken = default)
    {
        var system = await db.Systems.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (system is null)
        {
            return null;
        }

        await using var stream = file.OpenReadStream();
        system.LogoPath = await artwork.SaveSystemLogoAsync(id, stream, file.FileName, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Systems",
            EventType = "LogoUploaded",
            Message = $"Logo uploaded for {system.Name}",
            EntityType = "System",
            EntityId = system.Id,
        }, cancellationToken);

        return EntityMappers.ToDto(system);
    }

    public async Task<FileStreamResult?> GetLogoAsync(
        string id,
        HttpResponse response,
        CancellationToken cancellationToken = default)
    {
        var system = await db.Systems.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (system is null || string.IsNullOrWhiteSpace(system.LogoPath))
        {
            return null;
        }

        return fileDownload.OpenImage(system.LogoPath, response);
    }

    public async Task<IReadOnlyList<GameSystemDto>> ResolveByExtensionAsync(
        string ext,
        CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeExtension(ext);
        var systems = await db.Systems.OrderBy(s => s.Name).ToListAsync(cancellationToken);
        var matches = systems
            .Where(s => s.Extensions.Any(e =>
                string.Equals(e, normalized, StringComparison.OrdinalIgnoreCase)))
            .ToList();

        return matches.Select(EntityMappers.ToDto).ToList();
    }

    public async Task<GameSystemDto?> AddExtensionAsync(
        string id,
        string extension,
        CancellationToken cancellationToken = default)
    {
        var system = await db.Systems.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (system is null)
        {
            return null;
        }

        var ext = NormalizeExtension(extension);
        if (!system.Extensions.Contains(ext))
        {
            system.Extensions.Add(ext);
            await db.SaveChangesAsync(cancellationToken);

            await eventLogger.WriteAsync(new AppLogEvent
            {
                Category = "Systems",
                EventType = "ExtensionAdded",
                Message = $"Extension {ext} added to {system.Name}",
                EntityType = "System",
                EntityId = system.Id,
            }, cancellationToken);
        }

        return EntityMappers.ToDto(system);
    }

    public async Task<DeleteStatus> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var system = await db.Systems.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (system is null)
        {
            return DeleteStatus.NotFound();
        }

        var inUse = await db.Games.AnyAsync(
            g => g.System == system.Name || g.System == system.ShortName,
            cancellationToken);

        if (inUse)
        {
            return DeleteStatus.Conflicted(
                $"Cannot delete {system.Name}: games still reference this system.");
        }

        var name = system.Name;
        db.Systems.Remove(system);
        await db.SaveChangesAsync(cancellationToken);

        fileStorage.TryDeleteFile(system.LogoPath);
        fileStorage.TryDeleteDirectory(fileStorage.GetArtworkDirPath("systems", id));

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Systems",
            EventType = "Deleted",
            Message = $"System deleted: {name}",
            EntityType = "System",
            EntityId = id,
        }, cancellationToken);

        return DeleteStatus.Ok();
    }

    private static string NormalizeExtension(string extension) =>
        extension.StartsWith('.') ? extension : $".{extension}";

    private static string NormalizeStatus(string? status)
    {
        var value = (status ?? "active").Trim().ToLowerInvariant();
        return value is "active" or "hidden" or "archived" ? value : "active";
    }

    /// <summary>
    /// Uses an explicit EmulatorJS core when provided; otherwise maps common ShortName values.
    /// </summary>
    internal static string ResolveEmulatorJsCore(string? requested, string shortName)
    {
        if (!string.IsNullOrWhiteSpace(requested))
        {
            return requested.Trim().ToLowerInvariant();
        }

        return DefaultCoreForShortName(shortName);
    }

    internal static string DefaultCoreForShortName(string? shortName)
    {
        var key = (shortName ?? string.Empty).Trim().ToLowerInvariant();
        return key switch
        {
            "nes" or "famicom" => "nes",
            "snes" or "super nintendo" or "sfc" => "snes",
            "gb" or "game boy" or "gameboy" => "gb",
            "gbc" or "game boy color" => "gb",
            "gba" or "game boy advance" => "gba",
            "genesis" or "megadrive" or "mega drive" or "md" => "segaMD",
            "gg" or "game gear" or "gamegear" => "segaGG",
            "sms" or "master system" or "mastersystem" => "segaMS",
            "atari2600" or "a2600" or "2600" => "atari2600",
            "n64" or "nintendo 64" => "n64",
            "vb" or "virtual boy" or "virtualboy" => "vb",
            _ => string.Empty,
        };
    }

    private static Dictionary<string, string> ToProviderIds(IReadOnlyDictionary<string, string>? source)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (source is null)
        {
            return result;
        }

        foreach (var (key, value) in source)
        {
            if (!string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(value))
            {
                result[key.Trim()] = value.Trim();
            }
        }

        return result;
    }
}


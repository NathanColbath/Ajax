using GameLibrary.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Data;

/// <summary>
/// Ensures minimal defaults only — no catalog seed data.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db, CancellationToken cancellationToken = default)
    {
        if (!await db.SystemConfig.AnyAsync(cancellationToken))
        {
            db.SystemConfig.Add(new SystemConfigEntity
            {
                Id = "default",
                LibraryName = "Game Library",
                AllowStandardUploads = false,
                ApiModeNote = "Create systems, then upload files. Live API starts with an empty catalog.",
            });
            await db.SaveChangesAsync(cancellationToken);
        }

        await SeedMetadataProvidersAsync(db, cancellationToken);
    }

    private static async Task SeedMetadataProvidersAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var providers = await db.MetadataProviders.ToListAsync(cancellationToken);
        var byId = providers.ToDictionary(p => p.Id, StringComparer.OrdinalIgnoreCase);

        if (!byId.ContainsKey("hasheous"))
        {
            db.MetadataProviders.Add(new MetadataProvider
            {
                Id = "hasheous",
                Name = "Hasheous",
                Description = "Matches ROM SHA256 hashes via Hasheous and enriches games through the IGDB metadata proxy.",
                Enabled = true,
                LastRunLabel = "Never",
                Status = "idle",
            });
        }

        if (!byId.ContainsKey("manual"))
        {
            db.MetadataProviders.Add(new MetadataProvider
            {
                Id = "manual",
                Name = "Manual entry",
                Description = "Edit game and system metadata and upload cover art locally. Always available.",
                Enabled = true,
                LastRunLabel = "Always on",
                Status = "idle",
            });
        }

        if (byId.TryGetValue("libretro", out var libretro))
        {
            libretro.Enabled = false;
            libretro.Status = "idle";
            libretro.Description = "Deprecated — replaced by Hasheous hash lookup + IGDB metadata proxy.";
            libretro.LastRunLabel = "Disabled";
        }

        if (db.ChangeTracker.HasChanges())
        {
            await db.SaveChangesAsync(cancellationToken);
        }
    }
}


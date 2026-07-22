using GameLibrary.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api;

/// <summary>
/// Lightweight SQLite patches for databases created with EnsureCreated (no EF migrations).
/// </summary>
public static class SchemaPatches
{
    public static async Task ApplyAsync(AppDbContext db, CancellationToken cancellationToken = default)
    {
        await EnsureColumnAsync(db, "GameFiles", "Md5Hash", "TEXT NULL", cancellationToken);
        await EnsureColumnAsync(db, "GameFiles", "Sha1Hash", "TEXT NULL", cancellationToken);
        await EnsureColumnAsync(db, "Games", "PublicRating", "REAL NULL", cancellationToken);
        await EnsureColumnAsync(db, "Games", "PublicRatingsCount", "INTEGER NULL", cancellationToken);
        await EnsureColumnAsync(db, "Games", "PublicCriticScore", "INTEGER NULL", cancellationToken);
        await EnsureColumnAsync(db, "Games", "PublicRatingProvider", "TEXT NOT NULL DEFAULT ''", cancellationToken);
        await EnsureColumnAsync(db, "Games", "PublicRatingScale", "INTEGER NOT NULL DEFAULT 100", cancellationToken);
        await EnsureGameReviewsTableAsync(db, cancellationToken);
        await EnsureGameCuratedReviewsTableAsync(db, cancellationToken);
        await EnsurePublicEnrichmentStateTableAsync(db, cancellationToken);
        await EnsureUserGameListsTablesAsync(db, cancellationToken);
        await EnsurePhysicalItemGameIdAsync(db, cancellationToken);
        await EnsureSystemEmulatorJsCoreAsync(db, cancellationToken);
        await EnsureSystemConfigColumnsAsync(db, cancellationToken);
    }

    private static async Task EnsureSystemEmulatorJsCoreAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        await EnsureColumnAsync(db, "Systems", "EmulatorJsCore", "TEXT NOT NULL DEFAULT ''", cancellationToken);

        // Backfill empty cores from common short names (SQLite COLLATE NOCASE).
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE "Systems" SET "EmulatorJsCore" = 'nes'
            WHERE ("EmulatorJsCore" IS NULL OR "EmulatorJsCore" = '')
              AND lower("ShortName") IN ('nes', 'famicom');
            """,
            cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE "Systems" SET "EmulatorJsCore" = 'snes'
            WHERE ("EmulatorJsCore" IS NULL OR "EmulatorJsCore" = '')
              AND lower("ShortName") IN ('snes', 'sfc');
            """,
            cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE "Systems" SET "EmulatorJsCore" = 'gb'
            WHERE ("EmulatorJsCore" IS NULL OR "EmulatorJsCore" = '')
              AND lower("ShortName") IN ('gb', 'gbc');
            """,
            cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE "Systems" SET "EmulatorJsCore" = 'gba'
            WHERE ("EmulatorJsCore" IS NULL OR "EmulatorJsCore" = '')
              AND lower("ShortName") = 'gba';
            """,
            cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE "Systems" SET "EmulatorJsCore" = 'segaMD'
            WHERE ("EmulatorJsCore" IS NULL OR "EmulatorJsCore" = '')
              AND lower("ShortName") IN ('genesis', 'md', 'megadrive');
            """,
            cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE "Systems" SET "EmulatorJsCore" = 'segaGG'
            WHERE ("EmulatorJsCore" IS NULL OR "EmulatorJsCore" = '')
              AND lower("ShortName") IN ('gg', 'gamegear');
            """,
            cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE "Systems" SET "EmulatorJsCore" = 'segaMS'
            WHERE ("EmulatorJsCore" IS NULL OR "EmulatorJsCore" = '')
              AND lower("ShortName") IN ('sms', 'mastersystem');
            """,
            cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE "Systems" SET "EmulatorJsCore" = 'atari2600'
            WHERE ("EmulatorJsCore" IS NULL OR "EmulatorJsCore" = '')
              AND lower("ShortName") IN ('atari2600', 'a2600', '2600');
            """,
            cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE "Systems" SET "EmulatorJsCore" = 'n64'
            WHERE ("EmulatorJsCore" IS NULL OR "EmulatorJsCore" = '')
              AND lower("ShortName") = 'n64';
            """,
            cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE "Systems" SET "EmulatorJsCore" = 'vb'
            WHERE ("EmulatorJsCore" IS NULL OR "EmulatorJsCore" = '')
              AND lower("ShortName") IN ('vb', 'virtualboy');
            """,
            cancellationToken);
    }

    private static async Task EnsureSystemConfigColumnsAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var columns = new (string Name, string SqlType)[]
        {
            ("AllowStandardExports", "INTEGER NOT NULL DEFAULT 0"),
            ("RequireLoginForLibraryBrowse", "INTEGER NOT NULL DEFAULT 1"),
            ("MaxUploadBytes", "INTEGER NOT NULL DEFAULT 536870912"),
            ("DefaultUploadAccept", "TEXT NOT NULL DEFAULT '.nes,.sfc,.smc,.md,.gen,.bin,.cue,.iso,.chd,.zip'"),
            ("UploadPollIntervalMs", "INTEGER NOT NULL DEFAULT 2500"),
            ("AutoMatchAfterUpload", "INTEGER NOT NULL DEFAULT 1"),
            ("MaxParallelUploadJobs", "INTEGER NOT NULL DEFAULT 2"),
            ("BackgroundJobsEnabled", "INTEGER NOT NULL DEFAULT 1"),
            ("JobScheduleEnabled", "INTEGER NOT NULL DEFAULT 0"),
            ("JobAllowedStartLocal", "TEXT NOT NULL DEFAULT '00:00'"),
            ("JobAllowedEndLocal", "TEXT NOT NULL DEFAULT '23:59'"),
            ("JobTimeZoneId", "TEXT NOT NULL DEFAULT 'UTC'"),
            ("MaxJobRuntimeMinutes", "INTEGER NOT NULL DEFAULT 60"),
            ("UploadJobsRespectSchedule", "INTEGER NOT NULL DEFAULT 0"),
            ("MetadataJobsRespectSchedule", "INTEGER NOT NULL DEFAULT 1"),
            ("EnrichmentJobsRespectSchedule", "INTEGER NOT NULL DEFAULT 1"),
            ("ExportJobsRespectSchedule", "INTEGER NOT NULL DEFAULT 1"),
            ("ScheduledMetadataCron", "TEXT NOT NULL DEFAULT ''"),
            ("ScheduledEnrichmentCron", "TEXT NOT NULL DEFAULT ''"),
            ("HasheousBatchSize", "INTEGER NOT NULL DEFAULT 25"),
            ("EnrichmentBatchSize", "INTEGER NOT NULL DEFAULT 15"),
            ("EnrichmentCandidatePool", "INTEGER NOT NULL DEFAULT 200"),
            ("MaxScreenshotsPerGame", "INTEGER NOT NULL DEFAULT 4"),
            ("MaxCuratedReviewsPerGame", "INTEGER NOT NULL DEFAULT 3"),
            ("DeepSeekTemperature", "REAL NOT NULL DEFAULT 0.3"),
            ("DashboardFavoritesLimit", "INTEGER NOT NULL DEFAULT 6"),
            ("DashboardRecentLimit", "INTEGER NOT NULL DEFAULT 5"),
            ("GameReviewsPageSize", "INTEGER NOT NULL DEFAULT 50"),
            ("DefaultLibraryPageSize", "INTEGER NOT NULL DEFAULT 8"),
            ("SearchDebounceMs", "INTEGER NOT NULL DEFAULT 300"),
            ("DefaultRatingScale", "INTEGER NOT NULL DEFAULT 100"),
            ("LogListDefaultLimit", "INTEGER NOT NULL DEFAULT 100"),
            ("LogPurgeDefaultDays", "INTEGER NOT NULL DEFAULT 30"),
            ("LogAutoRefreshIntervalMs", "INTEGER NOT NULL DEFAULT 5000"),
        };

        foreach (var (name, sqlType) in columns)
        {
            await EnsureColumnAsync(db, "SystemConfig", name, sqlType, cancellationToken);
        }
    }

    private static async Task EnsureGameReviewsTableAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        // EnsureCreated() does not add tables to existing DBs — create explicitly.
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "GameReviews" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_GameReviews" PRIMARY KEY,
                "GameId" TEXT NOT NULL,
                "UserId" TEXT NOT NULL,
                "Rating" INTEGER NOT NULL,
                "Body" TEXT NOT NULL,
                "CreatedAt" TEXT NOT NULL,
                "UpdatedAt" TEXT NOT NULL,
                CONSTRAINT "FK_GameReviews_Games_GameId" FOREIGN KEY ("GameId") REFERENCES "Games" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_GameReviews_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );
            """,
            cancellationToken);

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_GameReviews_UserId_GameId"
            ON "GameReviews" ("UserId", "GameId");
            """,
            cancellationToken);
    }

    private static async Task EnsureGameCuratedReviewsTableAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "GameCuratedReviews" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_GameCuratedReviews" PRIMARY KEY,
                "GameId" TEXT NOT NULL,
                "Author" TEXT NOT NULL,
                "Text" TEXT NOT NULL,
                "Url" TEXT NOT NULL,
                "Provider" TEXT NOT NULL,
                "CreatedAt" TEXT NOT NULL,
                CONSTRAINT "FK_GameCuratedReviews_Games_GameId" FOREIGN KEY ("GameId") REFERENCES "Games" ("Id") ON DELETE CASCADE
            );
            """,
            cancellationToken);

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE INDEX IF NOT EXISTS "IX_GameCuratedReviews_GameId_Provider"
            ON "GameCuratedReviews" ("GameId", "Provider");
            """,
            cancellationToken);
    }

    private static async Task EnsurePublicEnrichmentStateTableAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "PublicEnrichmentStates" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_PublicEnrichmentStates" PRIMARY KEY,
                "Status" TEXT NOT NULL,
                "LastRunLabel" TEXT NOT NULL,
                "UpdatedAt" TEXT NOT NULL
            );
            """,
            cancellationToken);
    }

    private static async Task EnsureUserGameListsTablesAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "UserGameLists" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_UserGameLists" PRIMARY KEY,
                "UserId" TEXT NOT NULL,
                "Name" TEXT NOT NULL,
                "CreatedAt" TEXT NOT NULL,
                "UpdatedAt" TEXT NOT NULL,
                CONSTRAINT "FK_UserGameLists_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );
            """,
            cancellationToken);

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE INDEX IF NOT EXISTS "IX_UserGameLists_UserId"
            ON "UserGameLists" ("UserId");
            """,
            cancellationToken);

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "UserGameListItems" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_UserGameListItems" PRIMARY KEY,
                "ListId" TEXT NOT NULL,
                "GameId" TEXT NOT NULL,
                "AddedAt" TEXT NOT NULL,
                CONSTRAINT "FK_UserGameListItems_UserGameLists_ListId" FOREIGN KEY ("ListId") REFERENCES "UserGameLists" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_UserGameListItems_Games_GameId" FOREIGN KEY ("GameId") REFERENCES "Games" ("Id") ON DELETE CASCADE
            );
            """,
            cancellationToken);

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_UserGameListItems_ListId_GameId"
            ON "UserGameListItems" ("ListId", "GameId");
            """,
            cancellationToken);

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "GameListDownloadJobs" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_GameListDownloadJobs" PRIMARY KEY,
                "UserId" TEXT NOT NULL,
                "ListId" TEXT NOT NULL,
                "ListName" TEXT NOT NULL,
                "Status" TEXT NOT NULL,
                "Progress" INTEGER NOT NULL,
                "FilePath" TEXT NULL,
                "FileName" TEXT NULL,
                "Message" TEXT NOT NULL,
                "CreatedAt" TEXT NOT NULL,
                "CompletedAt" TEXT NULL
            );
            """,
            cancellationToken);

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE INDEX IF NOT EXISTS "IX_GameListDownloadJobs_UserId"
            ON "GameListDownloadJobs" ("UserId");
            """,
            cancellationToken);

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE INDEX IF NOT EXISTS "IX_GameListDownloadJobs_Status"
            ON "GameListDownloadJobs" ("Status");
            """,
            cancellationToken);
    }

    private static async Task EnsurePhysicalItemGameIdAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        await EnsureColumnAsync(db, "PhysicalItems", "GameId", "TEXT NULL", cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE INDEX IF NOT EXISTS "IX_PhysicalItems_GameId"
            ON "PhysicalItems" ("GameId");
            """,
            cancellationToken);
    }

    private static async Task EnsureColumnAsync(
        AppDbContext db,
        string table,
        string column,
        string sqlType,
        CancellationToken cancellationToken)
    {
        var exists = false;
        await using (var command = db.Database.GetDbConnection().CreateCommand())
        {
            await db.Database.OpenConnectionAsync(cancellationToken);
            command.CommandText = $"PRAGMA table_info({table});";
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase))
                {
                    exists = true;
                    break;
                }
            }
        }

        if (exists)
        {
            return;
        }

        await db.Database.ExecuteSqlRawAsync(
            "ALTER TABLE \"" + table + "\" ADD COLUMN \"" + column + "\" " + sqlType + ";",
            cancellationToken);
    }
}

using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Entities;
using GameLibrary.Api.Mapping;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GameLibrary.Api.Services;

public class ConfigService(
    AppDbContext db,
    FileStorageService fileStorage,
    IAppEventLogger eventLogger,
    IOptions<HasheousOptions> hasheous,
    IOptions<IgdbOptions> igdb,
    IOptions<DeepSeekOptions> deepSeek,
    IOptions<JobsOptions> jobsOptions,
    ILogger<ConfigService> logger)
{
    private static readonly string[] BusyUploadStates = ["queued", "uploading", "processing"];
    private static readonly string[] BusyJobStatuses = ["queued", "running", "processing"];

    public async Task<SystemConfigDto> GetSystemConfigAsync(CancellationToken cancellationToken = default)
    {
        var config = await GetOrCreateConfigAsync(cancellationToken);
        return ToEffectiveDto(config);
    }

    public async Task<SystemConfigDto> UpdateSystemConfigAsync(
        UpdateSystemConfigRequest patch,
        CancellationToken cancellationToken = default)
    {
        var config = await GetOrCreateConfigAsync(cancellationToken);
        ApplyPatch(config, patch);
        Clamp(config);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Config",
            EventType = "Updated",
            Message = "System configuration updated",
            EntityType = "SystemConfig",
            EntityId = config.Id,
        }, cancellationToken);

        return ToEffectiveDto(config);
    }

    public IntegrationsStatusDto GetIntegrationsStatus()
    {
        var h = hasheous.Value;
        var i = igdb.Value;
        var d = deepSeek.Value;
        return new IntegrationsStatusDto(
            !string.IsNullOrWhiteSpace(h.ApiKey),
            !string.IsNullOrWhiteSpace(i.ClientId) && !string.IsNullOrWhiteSpace(i.ClientSecret),
            !string.IsNullOrWhiteSpace(d.ApiKey));
    }

    public Task<StorageMetricsDto> GetStorageMetricsAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var snap = fileStorage.GetUsageSnapshot();
        return Task.FromResult(new StorageMetricsDto(
            snap.UsedGb,
            snap.TotalGb,
            snap.FreeGb,
            snap.Paths
                .Select(p => new StoragePathMetricDto(p.Path, p.UsedGb, p.TotalGb, p.Health))
                .ToList()));
    }

    public async Task<FactoryWipeResultDto> WipeAsync(CancellationToken cancellationToken = default)
    {
        var busyReason = await GetBusyReasonAsync(cancellationToken);
        if (busyReason is not null)
        {
            throw new WipeBusyException(busyReason);
        }

        logger.LogWarning("Factory wipe starting — clearing storage and database rows.");

        fileStorage.ClearAllContents();

        await ClearAllTablesAsync(cancellationToken);
        await EnsureMinimalWiringAsync(cancellationToken);

        var config = await GetOrCreateConfigAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Config",
            EventType = "FactoryWipe",
            Message = "Factory wipe completed — catalog empty; SystemConfig and metadata providers restored.",
            EntityType = "SystemConfig",
            EntityId = config.Id,
        }, cancellationToken);

        logger.LogWarning("Factory wipe completed.");

        return new FactoryWipeResultDto(
            true,
            "Library wiped. Catalog is empty; files storage cleared.",
            ToEffectiveDto(config));
    }

    public async Task<SystemConfigEntity> GetOrCreateConfigAsync(CancellationToken cancellationToken = default)
    {
        var config = await db.SystemConfig.FirstOrDefaultAsync(cancellationToken);
        if (config is not null)
        {
            return config;
        }

        config = CreateDefaultEntity();
        db.SystemConfig.Add(config);
        await db.SaveChangesAsync(cancellationToken);
        return config;
    }

    public int ResolveMaxParallelUploads(SystemConfigEntity config)
    {
        var fromEnv = jobsOptions.Value.MaxParallelUploadJobs;
        var value = fromEnv ?? config.MaxParallelUploadJobs;
        return Math.Clamp(value, 1, 8);
    }

    public bool ResolveBackgroundJobsEnabled(SystemConfigEntity config) =>
        jobsOptions.Value.BackgroundJobsEnabled ?? config.BackgroundJobsEnabled;

    private SystemConfigDto ToEffectiveDto(SystemConfigEntity config)
    {
        var dto = EntityMappers.ToDto(config);
        var parallel = ResolveMaxParallelUploads(config);
        var bg = ResolveBackgroundJobsEnabled(config);
        return dto with
        {
            MaxParallelUploadJobs = parallel,
            BackgroundJobsEnabled = bg,
        };
    }

    private static SystemConfigEntity CreateDefaultEntity() => new()
    {
        Id = "default",
        LibraryName = "Game Library",
        AllowStandardUploads = false,
        ApiModeNote = string.Empty,
    };

    private static void ApplyPatch(SystemConfigEntity config, UpdateSystemConfigRequest patch)
    {
        if (patch.LibraryName is not null) config.LibraryName = patch.LibraryName;
        if (patch.AllowStandardUploads.HasValue) config.AllowStandardUploads = patch.AllowStandardUploads.Value;
        if (patch.ApiModeNote is not null) config.ApiModeNote = patch.ApiModeNote;
        if (patch.AllowStandardExports.HasValue) config.AllowStandardExports = patch.AllowStandardExports.Value;
        if (patch.RequireLoginForLibraryBrowse.HasValue) config.RequireLoginForLibraryBrowse = patch.RequireLoginForLibraryBrowse.Value;
        if (patch.MaxUploadBytes.HasValue) config.MaxUploadBytes = patch.MaxUploadBytes.Value;
        if (patch.DefaultUploadAccept is not null) config.DefaultUploadAccept = patch.DefaultUploadAccept;
        if (patch.UploadPollIntervalMs.HasValue) config.UploadPollIntervalMs = patch.UploadPollIntervalMs.Value;
        if (patch.AutoMatchAfterUpload.HasValue) config.AutoMatchAfterUpload = patch.AutoMatchAfterUpload.Value;
        if (patch.MaxParallelUploadJobs.HasValue) config.MaxParallelUploadJobs = patch.MaxParallelUploadJobs.Value;
        if (patch.BackgroundJobsEnabled.HasValue) config.BackgroundJobsEnabled = patch.BackgroundJobsEnabled.Value;
        if (patch.JobScheduleEnabled.HasValue) config.JobScheduleEnabled = patch.JobScheduleEnabled.Value;
        if (patch.JobAllowedStartLocal is not null) config.JobAllowedStartLocal = patch.JobAllowedStartLocal;
        if (patch.JobAllowedEndLocal is not null) config.JobAllowedEndLocal = patch.JobAllowedEndLocal;
        if (patch.JobTimeZoneId is not null) config.JobTimeZoneId = patch.JobTimeZoneId;
        if (patch.MaxJobRuntimeMinutes.HasValue) config.MaxJobRuntimeMinutes = patch.MaxJobRuntimeMinutes.Value;
        if (patch.UploadJobsRespectSchedule.HasValue) config.UploadJobsRespectSchedule = patch.UploadJobsRespectSchedule.Value;
        if (patch.MetadataJobsRespectSchedule.HasValue) config.MetadataJobsRespectSchedule = patch.MetadataJobsRespectSchedule.Value;
        if (patch.EnrichmentJobsRespectSchedule.HasValue) config.EnrichmentJobsRespectSchedule = patch.EnrichmentJobsRespectSchedule.Value;
        if (patch.ExportJobsRespectSchedule.HasValue) config.ExportJobsRespectSchedule = patch.ExportJobsRespectSchedule.Value;
        if (patch.ScheduledMetadataCron is not null) config.ScheduledMetadataCron = patch.ScheduledMetadataCron;
        if (patch.ScheduledEnrichmentCron is not null) config.ScheduledEnrichmentCron = patch.ScheduledEnrichmentCron;
        if (patch.HasheousBatchSize.HasValue) config.HasheousBatchSize = patch.HasheousBatchSize.Value;
        if (patch.EnrichmentBatchSize.HasValue) config.EnrichmentBatchSize = patch.EnrichmentBatchSize.Value;
        if (patch.EnrichmentCandidatePool.HasValue) config.EnrichmentCandidatePool = patch.EnrichmentCandidatePool.Value;
        if (patch.MaxScreenshotsPerGame.HasValue) config.MaxScreenshotsPerGame = patch.MaxScreenshotsPerGame.Value;
        if (patch.MaxCuratedReviewsPerGame.HasValue) config.MaxCuratedReviewsPerGame = patch.MaxCuratedReviewsPerGame.Value;
        if (patch.DeepSeekTemperature.HasValue) config.DeepSeekTemperature = patch.DeepSeekTemperature.Value;
        if (patch.DashboardFavoritesLimit.HasValue) config.DashboardFavoritesLimit = patch.DashboardFavoritesLimit.Value;
        if (patch.DashboardRecentLimit.HasValue) config.DashboardRecentLimit = patch.DashboardRecentLimit.Value;
        if (patch.GameReviewsPageSize.HasValue) config.GameReviewsPageSize = patch.GameReviewsPageSize.Value;
        if (patch.DefaultLibraryPageSize.HasValue) config.DefaultLibraryPageSize = patch.DefaultLibraryPageSize.Value;
        if (patch.SearchDebounceMs.HasValue) config.SearchDebounceMs = patch.SearchDebounceMs.Value;
        if (patch.DefaultRatingScale.HasValue) config.DefaultRatingScale = patch.DefaultRatingScale.Value;
        if (patch.LogListDefaultLimit.HasValue) config.LogListDefaultLimit = patch.LogListDefaultLimit.Value;
        if (patch.LogPurgeDefaultDays.HasValue) config.LogPurgeDefaultDays = patch.LogPurgeDefaultDays.Value;
        if (patch.LogAutoRefreshIntervalMs.HasValue) config.LogAutoRefreshIntervalMs = patch.LogAutoRefreshIntervalMs.Value;
    }

    private static void Clamp(SystemConfigEntity config)
    {
        config.MaxParallelUploadJobs = Math.Clamp(config.MaxParallelUploadJobs, 1, 8);
        config.UploadPollIntervalMs = Math.Clamp(config.UploadPollIntervalMs, 500, 60_000);
        config.MaxJobRuntimeMinutes = Math.Clamp(config.MaxJobRuntimeMinutes, 1, 24 * 60);
        config.HasheousBatchSize = Math.Clamp(config.HasheousBatchSize, 1, 200);
        config.EnrichmentBatchSize = Math.Clamp(config.EnrichmentBatchSize, 1, 100);
        config.EnrichmentCandidatePool = Math.Clamp(config.EnrichmentCandidatePool, 1, 2000);
        config.MaxScreenshotsPerGame = Math.Clamp(config.MaxScreenshotsPerGame, 0, 20);
        config.MaxCuratedReviewsPerGame = Math.Clamp(config.MaxCuratedReviewsPerGame, 0, 20);
        config.DeepSeekTemperature = Math.Clamp(config.DeepSeekTemperature, 0, 2);
        config.DashboardFavoritesLimit = Math.Clamp(config.DashboardFavoritesLimit, 1, 50);
        config.DashboardRecentLimit = Math.Clamp(config.DashboardRecentLimit, 1, 50);
        config.GameReviewsPageSize = Math.Clamp(config.GameReviewsPageSize, 1, 200);
        config.DefaultLibraryPageSize = Math.Clamp(config.DefaultLibraryPageSize, 1, 100);
        config.SearchDebounceMs = Math.Clamp(config.SearchDebounceMs, 0, 5000);
        config.LogListDefaultLimit = Math.Clamp(config.LogListDefaultLimit, 1, 500);
        config.LogPurgeDefaultDays = Math.Clamp(config.LogPurgeDefaultDays, 1, 3650);
        config.LogAutoRefreshIntervalMs = Math.Clamp(config.LogAutoRefreshIntervalMs, 1000, 120_000);
        config.MaxUploadBytes = Math.Clamp(config.MaxUploadBytes, 1_048_576, 2L * 1024 * 1024 * 1024);
    }

    private async Task<string?> GetBusyReasonAsync(CancellationToken cancellationToken)
    {
        if (await db.UploadJobs.AnyAsync(j => BusyUploadStates.Contains(j.State), cancellationToken))
        {
            return "Finish or cancel active upload jobs before wiping.";
        }

        if (await db.ExportJobs.AnyAsync(j => BusyJobStatuses.Contains(j.Status), cancellationToken))
        {
            return "Finish or cancel active export jobs before wiping.";
        }

        if (await db.GameListDownloadJobs.AnyAsync(j => BusyJobStatuses.Contains(j.Status), cancellationToken))
        {
            return "Finish or cancel active list download jobs before wiping.";
        }

        if (await db.BackgroundJobs.AnyAsync(j => BusyJobStatuses.Contains(j.Status), cancellationToken))
        {
            return "Wait for background jobs to finish before wiping.";
        }

        if (await db.MetadataProviders.AnyAsync(p => p.Status == "running", cancellationToken))
        {
            return "Wait for the metadata provider run to finish before wiping.";
        }

        if (await db.PublicEnrichmentStates.AnyAsync(s => s.Status == "running", cancellationToken))
        {
            return "Wait for public enrichment to finish before wiping.";
        }

        return null;
    }

    private async Task ClearAllTablesAsync(CancellationToken cancellationToken)
    {
        await db.GameReviews.ExecuteDeleteAsync(cancellationToken);
        await db.GameCuratedReviews.ExecuteDeleteAsync(cancellationToken);
        await db.UserGameListItems.ExecuteDeleteAsync(cancellationToken);
        await db.UserGameLists.ExecuteDeleteAsync(cancellationToken);
        await db.GameListDownloadJobs.ExecuteDeleteAsync(cancellationToken);
        await db.UserGameStates.ExecuteDeleteAsync(cancellationToken);
        await db.GameFiles.ExecuteDeleteAsync(cancellationToken);
        await db.DuplicateFiles.ExecuteDeleteAsync(cancellationToken);
        await db.DuplicateGroups.ExecuteDeleteAsync(cancellationToken);
        await db.PhysicalItems.ExecuteDeleteAsync(cancellationToken);
        await db.Games.ExecuteDeleteAsync(cancellationToken);
        await db.Locations.ExecuteDeleteAsync(cancellationToken);
        await db.Systems.ExecuteDeleteAsync(cancellationToken);
        await db.UploadJobs.ExecuteDeleteAsync(cancellationToken);
        await db.ExportJobs.ExecuteDeleteAsync(cancellationToken);
        await db.MetadataReviewItems.ExecuteDeleteAsync(cancellationToken);
        await db.MetadataProviders.ExecuteDeleteAsync(cancellationToken);
        await db.BackgroundJobs.ExecuteDeleteAsync(cancellationToken);
        await db.LogEntries.ExecuteDeleteAsync(cancellationToken);
        await db.StoragePaths.ExecuteDeleteAsync(cancellationToken);
        await db.PublicEnrichmentStates.ExecuteDeleteAsync(cancellationToken);
        await db.SystemConfig.ExecuteDeleteAsync(cancellationToken);
        await db.Users.ExecuteDeleteAsync(cancellationToken);
    }

    private async Task EnsureMinimalWiringAsync(CancellationToken cancellationToken)
    {
        db.SystemConfig.Add(CreateDefaultEntity());

        db.MetadataProviders.Add(new MetadataProvider
        {
            Id = "hasheous",
            Name = "Hasheous",
            Description = "Matches ROM hashes via Hasheous and enriches games through the IGDB metadata proxy.",
            Enabled = true,
            LastRunLabel = "Never",
            Status = "idle",
        });

        db.MetadataProviders.Add(new MetadataProvider
        {
            Id = "manual",
            Name = "Manual entry",
            Description = "Edit game and system metadata and upload cover art locally. Always available.",
            Enabled = true,
            LastRunLabel = "Always on",
            Status = "idle",
        });

        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class WipeBusyException(string message) : InvalidOperationException(message);

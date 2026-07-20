namespace GameLibrary.Api.Entities;

public class SystemConfigEntity : GameLibrary.Api.IJobScheduleConfig
{
    public string Id { get; set; } = "default";

    // Library & access
    public string LibraryName { get; set; } = "Game Library";
    public bool AllowStandardUploads { get; set; }
    public string ApiModeNote { get; set; } = string.Empty;
    public bool AllowStandardExports { get; set; }
    public bool RequireLoginForLibraryBrowse { get; set; } = true;

    // Uploads & files
    public long MaxUploadBytes { get; set; } = 536_870_912;
    public string DefaultUploadAccept { get; set; } =
        ".nes,.sfc,.smc,.md,.gen,.bin,.cue,.iso,.chd,.zip";
    public int UploadPollIntervalMs { get; set; } = 2500;
    public bool AutoMatchAfterUpload { get; set; } = true;
    public int MaxParallelUploadJobs { get; set; } = 2;

    // Jobs & run windows
    public bool BackgroundJobsEnabled { get; set; } = true;
    public bool JobScheduleEnabled { get; set; }
    public string JobAllowedStartLocal { get; set; } = "00:00";
    public string JobAllowedEndLocal { get; set; } = "23:59";
    public string JobTimeZoneId { get; set; } = "UTC";
    public int MaxJobRuntimeMinutes { get; set; } = 60;
    public bool UploadJobsRespectSchedule { get; set; }
    public bool MetadataJobsRespectSchedule { get; set; } = true;
    public bool EnrichmentJobsRespectSchedule { get; set; } = true;
    public bool ExportJobsRespectSchedule { get; set; } = true;
    public string ScheduledMetadataCron { get; set; } = string.Empty;
    public string ScheduledEnrichmentCron { get; set; } = string.Empty;

    // Metadata & enrichment
    public int HasheousBatchSize { get; set; } = 25;
    public int EnrichmentBatchSize { get; set; } = 15;
    public int EnrichmentCandidatePool { get; set; } = 200;
    public int MaxScreenshotsPerGame { get; set; } = 4;
    public int MaxCuratedReviewsPerGame { get; set; } = 3;
    public double DeepSeekTemperature { get; set; } = 0.3;

    // Catalog / dashboard / lists
    public int DashboardFavoritesLimit { get; set; } = 6;
    public int DashboardRecentLimit { get; set; } = 5;
    public int GameReviewsPageSize { get; set; } = 50;
    public int DefaultLibraryPageSize { get; set; } = 8;
    public int SearchDebounceMs { get; set; } = 300;
    public int DefaultRatingScale { get; set; } = 100;

    // Logs
    public int LogListDefaultLimit { get; set; } = 100;
    public int LogPurgeDefaultDays { get; set; } = 30;
    public int LogAutoRefreshIntervalMs { get; set; } = 5000;
}

namespace GameLibrary.Api.Dtos;

// ── Auth ──────────────────────────────────────────────────────────────────────

public record LoginRequest(string Username, string Password);

public record AuthSessionDto(
    string UserId,
    string DisplayName,
    string Role,
    string? Email = null);

// ── Users ─────────────────────────────────────────────────────────────────────

public record LibraryUserDto(
    string Id,
    string Name,
    string Email,
    string Role,
    bool Enabled,
    string Initials);

public record InviteUserRequest(string Name, string Email, string Role);

public record UserPreferencesDto(
    IReadOnlyList<string> DashboardSectionOrder,
    IReadOnlyList<string> DashboardHidden,
    IReadOnlyList<string> NavMorePaths);

public record UpdateUserPreferencesRequest(
    IReadOnlyList<string>? DashboardSectionOrder,
    IReadOnlyList<string>? DashboardHidden,
    IReadOnlyList<string>? NavMorePaths);

// ── Games ─────────────────────────────────────────────────────────────────────

public record GameSummaryDto(
    string Id,
    string Title,
    string System,
    string Region,
    int Year,
    bool Owned,
    bool HasArt,
    string Accent,
    double Rating,
    int DownloadCount,
    string Publisher = "",
    IReadOnlyList<string>? Genres = null,
    bool IsPhysicalOnly = false);

public record GameFileDto(
    string Id,
    string Name,
    string SizeLabel,
    string Extension);

public record GameDetailDto(
    string Id,
    string Title,
    string System,
    string Region,
    int Year,
    bool Owned,
    bool HasArt,
    string Accent,
    double Rating,
    int DownloadCount,
    string Description,
    string Publisher,
    string Developer,
    string ReleaseDate,
    int RatingCount,
    IReadOnlyList<string> Genres,
    IReadOnlyList<string> Tags,
    string Players,
    IReadOnlyList<string> Languages,
    IReadOnlyList<string> Screenshots,
    string Notes,
    string MetadataSource,
    string ExternalId,
    int ScreenshotCount,
    IReadOnlyList<GameFileDto> Files,
    bool Favorite,
    string PlayStatus,
    int? MyRating = null,
    string? MyReviewBody = null,
    bool IsPhysicalOnly = false);

public record UpsertGameReviewRequest(int Rating, string? Body = null);

public record GameReviewDto(
    string Id,
    string GameId,
    string UserId,
    string AuthorName,
    string AuthorInitials,
    int Rating,
    string Body,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    bool IsMine);

public record GamePublicFeedbackDto(
    bool Available,
    double? Rating,
    int? RatingsCount,
    int? Metacritic,
    string? SourceUrl,
    string Attribution,
    IReadOnlyList<GamePublicCommentDto> Comments,
    /// <summary>When set (e.g. 100), Rating is on this scale instead of 5 stars.</summary>
    int? RatingScale = null,
    string? RatingProvider = null);

public record GamePublicCommentDto(
    string Author,
    string Text,
    DateTimeOffset? CreatedAt,
    string Url);

public record UpdateGameRequest(
    string? Title = null,
    string? Region = null,
    int? Year = null,
    string? Description = null,
    string? Publisher = null,
    string? Developer = null,
    string? ReleaseDate = null,
    string? Players = null,
    string? Notes = null,
    IReadOnlyList<string>? Genres = null,
    IReadOnlyList<string>? Tags = null,
    IReadOnlyList<string>? Languages = null);

public record GamesQueryDto(
    string? Search = null,
    string? System = null,
    bool? OwnedOnly = null);

// ── Systems ───────────────────────────────────────────────────────────────────

public record GameSystemDto(
    string Id,
    string Name,
    string ShortName,
    string Manufacturer,
    IReadOnlyList<string> Extensions,
    int GameCount,
    string Icon,
    string Accent,
    string Description,
    string ReleasePeriod,
    string Generation,
    string Region,
    bool HasLogo,
    string PreferredStoragePath,
    IReadOnlyDictionary<string, string> MetadataProviderIds,
    string EmulatorInfo,
    string Status,
    string EmulatorJsCore = "");

public record CreateGameSystemRequest(
    string Name,
    string ShortName,
    string Manufacturer,
    IReadOnlyList<string> Extensions,
    string Icon,
    string Accent,
    string? Description = null,
    string? ReleasePeriod = null,
    string? Generation = null,
    string? Region = null,
    string? PreferredStoragePath = null,
    IReadOnlyDictionary<string, string>? MetadataProviderIds = null,
    string? EmulatorInfo = null,
    string? Status = null,
    string? EmulatorJsCore = null);

public record UpdateGameSystemRequest(
    string? Name = null,
    string? ShortName = null,
    string? Manufacturer = null,
    string? Icon = null,
    string? Accent = null,
    string? Description = null,
    string? ReleasePeriod = null,
    string? Generation = null,
    string? Region = null,
    string? PreferredStoragePath = null,
    IReadOnlyDictionary<string, string>? MetadataProviderIds = null,
    string? EmulatorInfo = null,
    string? Status = null,
    string? EmulatorJsCore = null);

public record AddExtensionRequest(string Extension);

// ── Locations ─────────────────────────────────────────────────────────────────

public record PhysicalLocationDto(
    string Id,
    string Name,
    string Type,
    string? Notes);

public record CreateLocationRequest(
    string Name,
    string Type,
    string? Notes = null);

public record UpdateLocationRequest(
    string Name,
    string Type,
    string? Notes = null);

// ── Physical ──────────────────────────────────────────────────────────────────

public record PhysicalItemDto(
    string Id,
    string? GameId,
    string Title,
    string System,
    string Condition,
    string LocationId,
    string LocationName,
    string Completeness,
    bool CheckedOut,
    string? Borrower,
    string Accent,
    bool HasArt,
    int Year);

public record CreatePhysicalItemRequest(
    string LocationId,
    string SystemId,
    string Condition,
    string Completeness,
    long? IgdbId = null,
    string? Title = null,
    string? ExternalId = null,
    string? SampleMd5 = null);

public record UpdatePhysicalItemRequest(
    string LocationId,
    string Condition,
    string Completeness);

public record PhysicalTitleSearchResultDto(
    long? IgdbId,
    string Title,
    int? Year,
    IReadOnlyList<string> Platforms,
    string? CoverUrl,
    string? ExternalId,
    string Source,
    string? SampleMd5);

public record CheckoutRequest(string? Borrower = null);

// ── Uploads ───────────────────────────────────────────────────────────────────

public record UploadJobDto(
    string Id,
    string Name,
    long Size,
    int Progress,
    string State,
    string? SystemId,
    string? GameId,
    string? Message);

// ── Metadata ──────────────────────────────────────────────────────────────────

public record MetadataProviderDto(
    string Id,
    string Name,
    string Description,
    bool Enabled,
    string LastRunLabel,
    string Status);

public record MetadataReviewItemDto(
    string Id,
    string FileName,
    string SuggestedTitle,
    string System,
    double Confidence,
    string? GameId = null,
    string? ProviderId = null,
    string? SuggestedCoverUrl = null);

public record PublicEnrichmentStatusDto(
    string Status,
    string LastRunLabel,
    DateTimeOffset UpdatedAt);

// ── Duplicates ────────────────────────────────────────────────────────────────

public record DuplicateFileDto(
    string Id,
    string Name,
    string Path,
    string SizeLabel,
    string System);

public record DuplicateGroupDto(
    string Id,
    string Hash,
    IReadOnlyList<DuplicateFileDto> Files);

public record KeepDuplicateRequest(string FileId);

// ── Exports ───────────────────────────────────────────────────────────────────

public record ExportJobDto(
    string Id,
    string Format,
    IReadOnlyList<string> Scopes,
    string Status,
    string CreatedLabel,
    string? FileName);

public record RunExportRequest(
    string Format,
    IReadOnlyList<string> Scopes);

// ── Config ────────────────────────────────────────────────────────────────────

public record SystemConfigDto(
    string LibraryName,
    bool AllowStandardUploads,
    string ApiModeNote,
    bool AllowStandardExports,
    bool RequireLoginForLibraryBrowse,
    long MaxUploadBytes,
    string DefaultUploadAccept,
    int UploadPollIntervalMs,
    bool AutoMatchAfterUpload,
    int MaxParallelUploadJobs,
    bool BackgroundJobsEnabled,
    bool JobScheduleEnabled,
    string JobAllowedStartLocal,
    string JobAllowedEndLocal,
    string JobTimeZoneId,
    int MaxJobRuntimeMinutes,
    bool UploadJobsRespectSchedule,
    bool MetadataJobsRespectSchedule,
    bool EnrichmentJobsRespectSchedule,
    bool ExportJobsRespectSchedule,
    string ScheduledMetadataCron,
    string ScheduledEnrichmentCron,
    int HasheousBatchSize,
    int EnrichmentBatchSize,
    int EnrichmentCandidatePool,
    int MaxScreenshotsPerGame,
    int MaxCuratedReviewsPerGame,
    double DeepSeekTemperature,
    int DashboardFavoritesLimit,
    int DashboardRecentLimit,
    int GameReviewsPageSize,
    int DefaultLibraryPageSize,
    int SearchDebounceMs,
    int DefaultRatingScale,
    int LogListDefaultLimit,
    int LogPurgeDefaultDays,
    int LogAutoRefreshIntervalMs);

public record UpdateSystemConfigRequest(
    string? LibraryName = null,
    bool? AllowStandardUploads = null,
    string? ApiModeNote = null,
    bool? AllowStandardExports = null,
    bool? RequireLoginForLibraryBrowse = null,
    long? MaxUploadBytes = null,
    string? DefaultUploadAccept = null,
    int? UploadPollIntervalMs = null,
    bool? AutoMatchAfterUpload = null,
    int? MaxParallelUploadJobs = null,
    bool? BackgroundJobsEnabled = null,
    bool? JobScheduleEnabled = null,
    string? JobAllowedStartLocal = null,
    string? JobAllowedEndLocal = null,
    string? JobTimeZoneId = null,
    int? MaxJobRuntimeMinutes = null,
    bool? UploadJobsRespectSchedule = null,
    bool? MetadataJobsRespectSchedule = null,
    bool? EnrichmentJobsRespectSchedule = null,
    bool? ExportJobsRespectSchedule = null,
    string? ScheduledMetadataCron = null,
    string? ScheduledEnrichmentCron = null,
    int? HasheousBatchSize = null,
    int? EnrichmentBatchSize = null,
    int? EnrichmentCandidatePool = null,
    int? MaxScreenshotsPerGame = null,
    int? MaxCuratedReviewsPerGame = null,
    double? DeepSeekTemperature = null,
    int? DashboardFavoritesLimit = null,
    int? DashboardRecentLimit = null,
    int? GameReviewsPageSize = null,
    int? DefaultLibraryPageSize = null,
    int? SearchDebounceMs = null,
    int? DefaultRatingScale = null,
    int? LogListDefaultLimit = null,
    int? LogPurgeDefaultDays = null,
    int? LogAutoRefreshIntervalMs = null);

public record IntegrationsStatusDto(
    bool HasheousConfigured,
    bool IgdbConfigured,
    bool DeepSeekConfigured);

public record StoragePathMetricDto(
    string Path,
    double UsedGb,
    double TotalGb,
    string Health);

public record StorageMetricsDto(
    double UsedGb,
    double TotalGb,
    double FreeGb,
    IReadOnlyList<StoragePathMetricDto> Paths);

public record FactoryWipeResultDto(
    bool Ok,
    string Message,
    SystemConfigDto Config);

// ── Dashboard ─────────────────────────────────────────────────────────────────

public record DashboardStatsDto(
    int MyFavorites,
    int MyDownloads,
    int MyLists,
    int LibraryGames,
    int PhysicalGames,
    int Systems,
    double StorageUsedGb,
    double StorageTotalGb);

public record DashboardAttentionItemDto(
    string Id,
    string Label,
    int Count,
    string Tone,
    string Link);

public record DashboardRecentGameDto(
    string Id,
    string Title,
    string System,
    string Accent,
    bool HasArt);

public record DashboardSystemTileDto(
    string Id,
    string Name,
    string ShortName,
    int GameCount,
    bool HasLogo);

public record DashboardSnapshotDto(
    string UserId,
    string DisplayName,
    DashboardStatsDto Stats,
    IReadOnlyList<DashboardAttentionItemDto> Attention,
    IReadOnlyList<DashboardRecentGameDto> ContinuePlaying,
    IReadOnlyList<DashboardRecentGameDto> RecentlyAdded,
    IReadOnlyList<DashboardRecentGameDto> Favorites,
    IReadOnlyList<DashboardSystemTileDto> Systems,
    IReadOnlyList<DashboardRecentGameDto> Recommendations);

// ── Logs ──────────────────────────────────────────────────────────────────────

public record LogEntryDto(
    long Id,
    DateTimeOffset Timestamp,
    string Level,
    string Category,
    string EventType,
    string Message,
    string? UserId,
    string? CorrelationId,
    string? RequestMethod,
    string? RequestPath,
    int? StatusCode,
    int? DurationMs,
    string? EntityType,
    string? EntityId,
    string? Exception,
    string? PropertiesJson);

public record LogQueryDto(
    long? AfterId = null,
    DateTimeOffset? Since = null,
    int? Limit = 100,
    string? Level = null,
    string? Category = null,
    string? CorrelationId = null,
    string? Search = null);

public record UserGameListSummaryDto(
    string Id,
    string Name,
    int GameCount,
    DateTimeOffset UpdatedAt);

public record UserGameListGameDto(
    string Id,
    string Title,
    string System,
    bool HasFiles,
    string Accent,
    bool HasArt);

public record UserGameListDetailDto(
    string Id,
    string Name,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<UserGameListGameDto> Games);

public record CreateUserGameListRequest(string Name);

public record UpdateUserGameListRequest(string Name);

public record AddGameToListRequest(string GameId);

public record GameListDownloadJobDto(
    string Id,
    string ListId,
    string ListName,
    string Status,
    int Progress,
    string? FileName,
    string Message,
    DateTimeOffset CreatedAt,
    DateTimeOffset? CompletedAt);

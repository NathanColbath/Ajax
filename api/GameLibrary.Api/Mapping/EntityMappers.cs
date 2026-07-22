using GameLibrary.Api.Dtos;
using GameLibrary.Api.Entities;

namespace GameLibrary.Api.Mapping;

public static class EntityMappers
{
    public static LibraryUserDto ToDto(AppUser user) =>
        new(user.Id, user.Name, user.Email, user.Role, user.Enabled, user.Initials);

    public static AuthSessionDto ToSessionDto(AppUser user) =>
        new(user.Id, user.Name, user.Role, user.Email);

    public static GameSummaryDto ToSummaryDto(Game game) =>
        new(
            game.Id,
            game.Title,
            game.System,
            game.Region,
            game.Year,
            game.Owned,
            game.HasArt,
            game.Accent,
            game.Rating,
            game.DownloadCount,
            game.Publisher,
            game.Genres);

    public static GameFileDto ToDto(GameFile file) =>
        new(file.Id, file.Name, file.SizeLabel, file.Extension);

    public static GameDetailDto ToDetailDto(
        Game game,
        UserGameState? userState,
        GameReview? myReview = null)
    {
        var favorite = userState?.Favorite ?? false;
        var playStatus = userState?.PlayStatus
            ?? (game.Owned ? "unplayed" : "wishlist");

        // Do not leak storage paths; expose screenshot indices for the media UI.
        var screenshotIndices = Enumerable.Range(0, game.Screenshots.Count)
            .Select(i => i.ToString())
            .ToList();

        return new GameDetailDto(
            game.Id,
            game.Title,
            game.System,
            game.Region,
            game.Year,
            game.Owned,
            game.HasArt,
            game.Accent,
            game.Rating,
            game.DownloadCount,
            game.Description,
            game.Publisher,
            game.Developer,
            game.ReleaseDate,
            game.RatingCount,
            game.Genres,
            game.Tags,
            game.Players,
            game.Languages,
            screenshotIndices,
            game.Notes,
            game.MetadataSource,
            game.ExternalId,
            game.Screenshots.Count,
            game.Files.Select(ToDto).ToList(),
            favorite,
            playStatus,
            myReview?.Rating,
            myReview?.Body);
    }

    public static GameReviewDto ToDto(GameReview review, string? currentUserId) =>
        new(
            review.Id,
            review.GameId,
            review.UserId,
            review.User?.Name ?? "User",
            review.User?.Initials ?? "?",
            review.Rating,
            review.Body,
            review.CreatedAt,
            review.UpdatedAt,
            !string.IsNullOrWhiteSpace(currentUserId)
                && string.Equals(review.UserId, currentUserId, StringComparison.Ordinal));

    public static GameSystemDto ToDto(GameSystem system) =>
        new(
            system.Id,
            system.Name,
            system.ShortName,
            system.Manufacturer,
            system.Extensions,
            system.GameCount,
            system.Icon,
            system.Accent,
            system.Description,
            system.ReleasePeriod,
            system.Generation,
            system.Region,
            !string.IsNullOrWhiteSpace(system.LogoPath),
            system.PreferredStoragePath,
            system.MetadataProviderIds,
            system.EmulatorInfo,
            system.Status,
            system.EmulatorJsCore);

    public static PhysicalLocationDto ToDto(PhysicalLocation location) =>
        new(location.Id, location.Name, location.Type, location.Notes);

    public static PhysicalItemDto ToDto(PhysicalItem item) =>
        new(
            item.Id,
            item.GameId,
            item.Title,
            item.System,
            item.Condition,
            item.LocationId,
            item.Location?.Name ?? string.Empty,
            item.Completeness,
            item.CheckedOut,
            item.Borrower,
            item.Accent,
            item.Game?.HasArt ?? false,
            item.Game?.Year ?? 0);

    public static UploadJobDto ToDto(UploadJob job) =>
        new(job.Id, job.Name, job.Size, job.Progress, job.State, job.SystemId, job.GameId, job.Message);

    public static MetadataProviderDto ToDto(MetadataProvider provider) =>
        new(
            provider.Id,
            provider.Name,
            provider.Description,
            provider.Enabled,
            provider.LastRunLabel,
            provider.Status);

    public static MetadataReviewItemDto ToDto(MetadataReviewItem item) =>
        new(
            item.Id,
            item.FileName,
            item.SuggestedTitle,
            item.System,
            item.Confidence,
            string.IsNullOrWhiteSpace(item.GameId) ? null : item.GameId,
            string.IsNullOrWhiteSpace(item.ProviderId) ? null : item.ProviderId,
            string.IsNullOrWhiteSpace(item.SuggestedCoverUrl) ? null : item.SuggestedCoverUrl);

    public static DuplicateFileDto ToDto(DuplicateFile file) =>
        new(file.Id, file.Name, file.Path, file.SizeLabel, file.System);

    public static DuplicateGroupDto ToDto(DuplicateGroup group) =>
        new(group.Id, group.Hash, group.Files.Select(ToDto).ToList());

    public static ExportJobDto ToDto(ExportJob job) =>
        new(job.Id, job.Format, job.Scopes, job.Status, job.CreatedLabel, job.FileName);

    public static SystemConfigDto ToDto(SystemConfigEntity config) =>
        new(
            config.LibraryName,
            config.AllowStandardUploads,
            config.ApiModeNote,
            config.AllowStandardExports,
            config.RequireLoginForLibraryBrowse,
            config.MaxUploadBytes,
            config.DefaultUploadAccept,
            config.UploadPollIntervalMs,
            config.AutoMatchAfterUpload,
            config.MaxParallelUploadJobs,
            config.BackgroundJobsEnabled,
            config.JobScheduleEnabled,
            config.JobAllowedStartLocal,
            config.JobAllowedEndLocal,
            config.JobTimeZoneId,
            config.MaxJobRuntimeMinutes,
            config.UploadJobsRespectSchedule,
            config.MetadataJobsRespectSchedule,
            config.EnrichmentJobsRespectSchedule,
            config.ExportJobsRespectSchedule,
            config.ScheduledMetadataCron,
            config.ScheduledEnrichmentCron,
            config.HasheousBatchSize,
            config.EnrichmentBatchSize,
            config.EnrichmentCandidatePool,
            config.MaxScreenshotsPerGame,
            config.MaxCuratedReviewsPerGame,
            config.DeepSeekTemperature,
            config.DashboardFavoritesLimit,
            config.DashboardRecentLimit,
            config.GameReviewsPageSize,
            config.DefaultLibraryPageSize,
            config.SearchDebounceMs,
            config.DefaultRatingScale,
            config.LogListDefaultLimit,
            config.LogPurgeDefaultDays,
            config.LogAutoRefreshIntervalMs);

    public static StorageMetricsDto ToStorageMetricsDto(
        IReadOnlyList<StoragePathEntity> paths,
        double usedGb,
        double totalGb) =>
        new(
            usedGb,
            totalGb,
            Math.Max(0, totalGb - usedGb),
            paths.Select(p => new StoragePathMetricDto(p.Path, p.UsedGb, p.TotalGb, p.Health)).ToList());

    public static string BuildInitials(string name)
    {
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0)
        {
            return "??";
        }

        return string.Concat(parts.Take(2).Select(p => char.ToUpperInvariant(p[0])))
            .PadRight(2, '?')[..2];
    }

    public static LogEntryDto ToDto(LogEntry entry) =>
        new(
            entry.Id,
            entry.Timestamp,
            entry.Level,
            entry.Category,
            entry.EventType,
            entry.Message,
            entry.UserId,
            entry.CorrelationId,
            entry.RequestMethod,
            entry.RequestPath,
            entry.StatusCode,
            entry.DurationMs,
            entry.EntityType,
            entry.EntityId,
            entry.Exception,
            entry.PropertiesJson);
}

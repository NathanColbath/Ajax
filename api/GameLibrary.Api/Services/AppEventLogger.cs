using GameLibrary.Api.Auth;
using GameLibrary.Api.Data;
using GameLibrary.Api.Entities;

namespace GameLibrary.Api.Services;

public interface IAppEventLogger
{
    Task WriteAsync(AppLogEvent logEvent, CancellationToken cancellationToken = default);
}

public sealed class AppLogEvent
{
    public string Level { get; init; } = "Information";
    public string Category { get; init; } = string.Empty;
    public string EventType { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string? UserId { get; init; }
    public string? CorrelationId { get; init; }
    public string? RequestMethod { get; init; }
    public string? RequestPath { get; init; }
    public int? StatusCode { get; init; }
    public int? DurationMs { get; init; }
    public string? EntityType { get; init; }
    public string? EntityId { get; init; }
    public string? Exception { get; init; }
    public string? PropertiesJson { get; init; }
}

public sealed class AppEventLogger(
    AppDbContext db,
    ICurrentUserService currentUser,
    IHttpContextAccessor httpContextAccessor,
    ILogger<AppEventLogger> logger) : IAppEventLogger
{
    public async Task WriteAsync(AppLogEvent logEvent, CancellationToken cancellationToken = default)
    {
        try
        {
            var http = httpContextAccessor.HttpContext;
            var correlationId = logEvent.CorrelationId
                ?? http?.Response.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? http?.Request.Headers["X-Correlation-Id"].FirstOrDefault()
                ?? http?.TraceIdentifier;

            var entry = new LogEntry
            {
                Timestamp = DateTimeOffset.UtcNow,
                Level = logEvent.Level,
                Category = logEvent.Category,
                EventType = logEvent.EventType,
                Message = logEvent.Message,
                UserId = logEvent.UserId ?? currentUser.UserId,
                CorrelationId = correlationId,
                RequestMethod = logEvent.RequestMethod,
                RequestPath = logEvent.RequestPath,
                StatusCode = logEvent.StatusCode,
                DurationMs = logEvent.DurationMs,
                EntityType = logEvent.EntityType,
                EntityId = logEvent.EntityId,
                Exception = Truncate(logEvent.Exception, 8000),
                PropertiesJson = logEvent.PropertiesJson,
            };

            db.LogEntries.Add(entry);
            await db.SaveChangesAsync(cancellationToken);

            logger.Log(
                MapLevel(logEvent.Level),
                "[{Category}/{EventType}] {Message}",
                logEvent.Category,
                logEvent.EventType,
                logEvent.Message);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to persist application log entry.");
        }
    }

    private static LogLevel MapLevel(string level) => level switch
    {
        "Trace" => LogLevel.Trace,
        "Debug" => LogLevel.Debug,
        "Warning" => LogLevel.Warning,
        "Error" => LogLevel.Error,
        "Critical" => LogLevel.Critical,
        _ => LogLevel.Information,
    };

    private static string? Truncate(string? value, int max) =>
        value is null || value.Length <= max ? value : value[..max];
}

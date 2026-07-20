namespace GameLibrary.Api.Entities;

public class LogEntry
{
    public long Id { get; set; }
    public DateTimeOffset Timestamp { get; set; }
    public string Level { get; set; } = "Information";
    public string Category { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public string? CorrelationId { get; set; }
    public string? RequestMethod { get; set; }
    public string? RequestPath { get; set; }
    public int? StatusCode { get; set; }
    public int? DurationMs { get; set; }
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public string? Exception { get; set; }
    public string? PropertiesJson { get; set; }
}

using System.Diagnostics;
using GameLibrary.Api.Services;

namespace GameLibrary.Api.Middleware;

public sealed class RequestLoggingMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IAppEventLogger eventLogger)
    {
        var path = context.Request.Path.Value ?? string.Empty;
        if (ShouldSkip(path))
        {
            await next(context);
            return;
        }

        var correlationId = context.Request.Headers["X-Correlation-Id"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(correlationId))
        {
            correlationId = Guid.NewGuid().ToString("N");
        }

        context.Response.Headers["X-Correlation-Id"] = correlationId;

        var sw = Stopwatch.StartNew();
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            sw.Stop();
            await eventLogger.WriteAsync(new AppLogEvent
            {
                Level = "Error",
                Category = "Http",
                EventType = "RequestFailed",
                Message = $"{context.Request.Method} {path} failed: {ex.Message}",
                CorrelationId = correlationId,
                RequestMethod = context.Request.Method,
                RequestPath = path,
                StatusCode = 500,
                DurationMs = (int)sw.ElapsedMilliseconds,
                Exception = ex.ToString(),
            });
            throw;
        }

        sw.Stop();
        await eventLogger.WriteAsync(new AppLogEvent
        {
            Level = context.Response.StatusCode >= 500 ? "Error"
                : context.Response.StatusCode >= 400 ? "Warning"
                : "Information",
            Category = "Http",
            EventType = "RequestCompleted",
            Message = $"{context.Request.Method} {path} → {context.Response.StatusCode} ({sw.ElapsedMilliseconds}ms)",
            CorrelationId = correlationId,
            RequestMethod = context.Request.Method,
            RequestPath = path,
            StatusCode = context.Response.StatusCode,
            DurationMs = (int)sw.ElapsedMilliseconds,
        });
    }

    private static bool ShouldSkip(string path)
    {
        if (path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (path.Equals("/api/logs", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/logs/", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return false;
    }
}

using System.Globalization;
using System.Text;
using System.Text.Json;
using GameLibrary.Api.Data;
using GameLibrary.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using GameLibrary.Api.Services;

namespace GameLibrary.Api.Engines;

public class ExportEngine(AppDbContext db, IOptions<StorageOptions> storageOptions, IAppEventLogger eventLogger)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    public async Task<string> ExportAsync(
        ExportJob job,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var root = Path.GetFullPath(storageOptions.Value.RootPath);
            var exportDir = Path.Combine(root, "exports");
            Directory.CreateDirectory(exportDir);

            var timestamp = DateTimeOffset.UtcNow.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture);
            var extension = job.Format.Equals("csv", StringComparison.OrdinalIgnoreCase) ? "csv" : "json";
            var fileName = $"export-{timestamp}.{extension}";
            var filePath = Path.Combine(exportDir, fileName);

            var payload = new Dictionary<string, object?>();
            foreach (var scope in job.Scopes)
            {
                payload[scope] = scope switch
                {
                    "games" => await db.Games
                        .Where(g => !g.IsPhysicalOnly)
                        .Select(g => new { g.Id, g.Title, g.System, g.Region, g.Year, g.Owned, g.Rating })
                        .ToListAsync(cancellationToken),
                    "physical" => await db.PhysicalItems
                        .Include(p => p.Location)
                        .Select(p => new
                        {
                            p.Id,
                            p.Title,
                            p.System,
                            p.Condition,
                            Location = p.Location!.Name,
                            p.Completeness,
                            p.CheckedOut,
                        })
                        .ToListAsync(cancellationToken),
                    "systems" => await db.Systems
                        .Select(s => new { s.Id, s.Name, s.ShortName, s.Manufacturer, s.GameCount })
                        .ToListAsync(cancellationToken),
                    _ => Array.Empty<object>(),
                };
            }

            if (extension == "json")
            {
                await File.WriteAllTextAsync(
                    filePath,
                    JsonSerializer.Serialize(payload, JsonOptions),
                    cancellationToken);
            }
            else
            {
                await File.WriteAllTextAsync(filePath, BuildCsv(payload), cancellationToken);
            }

            await eventLogger.WriteAsync(new AppLogEvent
            {
                Category = "Exports",
                EventType = "Completed",
                Message = $"Export completed: {fileName}",
                EntityType = "ExportJob",
                EntityId = job.Id,
            }, cancellationToken);

            return filePath;
        }
        catch (Exception ex)
        {
            await eventLogger.WriteAsync(new AppLogEvent
            {
                Level = "Error",
                Category = "Exports",
                EventType = "Failed",
                Message = $"Export failed for job {job.Id}",
                EntityType = "ExportJob",
                EntityId = job.Id,
                Exception = ex.ToString(),
            }, cancellationToken);

            throw;
        }
    }

    private static string BuildCsv(Dictionary<string, object?> payload)
    {
        var builder = new StringBuilder();
        foreach (var (scope, data) in payload)
        {
            builder.AppendLine($"# {scope}");
            builder.AppendLine(SerializeScopeToCsv(data));
            builder.AppendLine();
        }

        return builder.ToString();
    }

    private static string SerializeScopeToCsv(object? data)
    {
        if (data is not IEnumerable<object> rows)
        {
            return string.Empty;
        }

        var list = rows.ToList();
        if (list.Count == 0)
        {
            return string.Empty;
        }

        var props = list[0].GetType().GetProperties();
        var header = string.Join(',', props.Select(p => EscapeCsv(p.Name)));
        var lines = list.Select(row =>
            string.Join(',', props.Select(p => EscapeCsv(p.GetValue(row)?.ToString() ?? string.Empty))));

        return header + Environment.NewLine + string.Join(Environment.NewLine, lines);
    }

    private static string EscapeCsv(string value) =>
        value.Contains('"') || value.Contains(',') || value.Contains('\n')
            ? $"\"{value.Replace("\"", "\"\"")}\""
            : value;
}

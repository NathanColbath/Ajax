namespace GameLibrary.Api;

/// <summary>
/// Evaluates job run windows and simple 5-field cron (minute hour dom month dow) or HH:mm daily.
/// </summary>
public static class JobSchedule
{
    public static bool IsWithinWindow(IJobScheduleConfig config, DateTimeOffset utcNow)
    {
        if (!config.JobScheduleEnabled)
        {
            return true;
        }

        var zone = ResolveZone(config.JobTimeZoneId);
        var local = TimeZoneInfo.ConvertTime(utcNow, zone);
        var start = ParseTime(config.JobAllowedStartLocal) ?? TimeSpan.Zero;
        var end = ParseTime(config.JobAllowedEndLocal) ?? new TimeSpan(23, 59, 0);
        var now = local.TimeOfDay;

        if (start <= end)
        {
            return now >= start && now <= end;
        }

        return now >= start || now <= end;
    }

    public static bool JobTypeRespectsSchedule(IJobScheduleConfig config, string jobType) =>
        jobType.ToLowerInvariant() switch
        {
            "upload" => config.UploadJobsRespectSchedule,
            "metadata" => config.MetadataJobsRespectSchedule,
            "enrichment" or "deepseek" => config.EnrichmentJobsRespectSchedule,
            "export" => config.ExportJobsRespectSchedule,
            "list-zip" => false,
            _ => true,
        };

    public static bool CanStartJob(IJobScheduleConfig config, string jobType, DateTimeOffset utcNow)
    {
        if (!config.BackgroundJobsEnabled)
        {
            return false;
        }

        if (!JobTypeRespectsSchedule(config, jobType))
        {
            return true;
        }

        return IsWithinWindow(config, utcNow);
    }

    public static bool CronMatchesNow(string? cron, DateTimeOffset utcNow, string timeZoneId)
    {
        if (string.IsNullOrWhiteSpace(cron))
        {
            return false;
        }

        var zone = ResolveZone(timeZoneId);
        var local = TimeZoneInfo.ConvertTime(utcNow, zone);
        var trimmed = cron.Trim();
        var parts = trimmed.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (parts.Length == 1)
        {
            var tod = ParseTime(parts[0]);
            return tod is not null && local.Hour == tod.Value.Hours && local.Minute == tod.Value.Minutes;
        }

        if (parts.Length < 2)
        {
            return false;
        }

        if (!TryMatchField(parts[0], local.Minute) || !TryMatchField(parts[1], local.Hour))
        {
            return false;
        }

        if (parts.Length >= 3 && !TryMatchField(parts[2], local.Day))
        {
            return false;
        }

        if (parts.Length >= 4 && !TryMatchField(parts[3], local.Month))
        {
            return false;
        }

        if (parts.Length >= 5)
        {
            var dow = (int)local.DayOfWeek;
            if (!TryMatchField(parts[4], dow))
            {
                return false;
            }
        }

        return true;
    }

    private static bool TryMatchField(string field, int value)
    {
        if (field == "*")
        {
            return true;
        }

        foreach (var part in field.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (int.TryParse(part, out var n) && n == value)
            {
                return true;
            }
        }

        return false;
    }

    private static TimeSpan? ParseTime(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (TimeSpan.TryParseExact(value.Trim(), @"hh\:mm", null, out var ts)
            || TimeSpan.TryParseExact(value.Trim(), @"h\:mm", null, out ts))
        {
            return ts;
        }

        return null;
    }

    private static TimeZoneInfo ResolveZone(string timeZoneId)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch
        {
            return TimeZoneInfo.Utc;
        }
    }
}

public interface IJobScheduleConfig
{
    bool BackgroundJobsEnabled { get; }
    bool JobScheduleEnabled { get; }
    string JobAllowedStartLocal { get; }
    string JobAllowedEndLocal { get; }
    string JobTimeZoneId { get; }
    bool UploadJobsRespectSchedule { get; }
    bool MetadataJobsRespectSchedule { get; }
    bool EnrichmentJobsRespectSchedule { get; }
    bool ExportJobsRespectSchedule { get; }
}

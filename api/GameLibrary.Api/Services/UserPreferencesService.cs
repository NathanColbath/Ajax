using System.Text.Json;
using System.Text.Json.Serialization;
using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Services;

public class UserPreferencesService(AppDbContext db, AuthService authService)
{
    private static readonly string[] KnownDashboardSections =
    [
        "libraryStats",
        "continuePlaying",
        "recentlyAdded",
        "favorites",
        "systems",
        "recommendations",
        "attention",
    ];

    private static readonly HashSet<string> KnownNavPaths = new(StringComparer.Ordinal)
    {
        "/",
        "/games",
        "/lists",
        "/physical",
        "/systems",
        "/uploads",
        "/metadata",
        "/duplicates",
        "/exports",
        "/logs",
        "/users",
        "/config",
        "/settings",
    };

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true,
    };

    public async Task<UserPreferencesDto?> GetAsync(CancellationToken cancellationToken = default)
    {
        var user = await authService.EnsureUserAsync(cancellationToken);
        if (user is null)
        {
            return null;
        }

        return MergeWithDefaults(Parse(user.PreferencesJson));
    }

    public async Task<UserPreferencesDto?> UpdateAsync(
        UpdateUserPreferencesRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await authService.EnsureUserAsync(cancellationToken);
        if (user is null)
        {
            return null;
        }

        var current = MergeWithDefaults(Parse(user.PreferencesJson));
        var next = MergeWithDefaults(new StoredPreferences
        {
            DashboardSectionOrder = request.DashboardSectionOrder?.ToList() ?? current.DashboardSectionOrder.ToList(),
            DashboardHidden = request.DashboardHidden?.ToList() ?? current.DashboardHidden.ToList(),
            NavMorePaths = request.NavMorePaths?.ToList() ?? current.NavMorePaths.ToList(),
        });

        var tracked = await db.Users.FirstAsync(u => u.Id == user.Id, cancellationToken);
        tracked.PreferencesJson = JsonSerializer.Serialize(
            new StoredPreferences
            {
                DashboardSectionOrder = next.DashboardSectionOrder.ToList(),
                DashboardHidden = next.DashboardHidden.ToList(),
                NavMorePaths = next.NavMorePaths.ToList(),
            },
            JsonOptions);
        await db.SaveChangesAsync(cancellationToken);
        return next;
    }

    private static StoredPreferences Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new StoredPreferences();
        }

        try
        {
            return JsonSerializer.Deserialize<StoredPreferences>(json, JsonOptions) ?? new StoredPreferences();
        }
        catch (JsonException)
        {
            return new StoredPreferences();
        }
    }

    private static UserPreferencesDto MergeWithDefaults(StoredPreferences stored)
    {
        var order = new List<string>();
        foreach (var id in stored.DashboardSectionOrder ?? [])
        {
            if (KnownDashboardSections.Contains(id, StringComparer.Ordinal) && !order.Contains(id, StringComparer.Ordinal))
            {
                order.Add(id);
            }
        }

        foreach (var id in KnownDashboardSections)
        {
            if (!order.Contains(id, StringComparer.Ordinal))
            {
                order.Add(id);
            }
        }

        var hidden = (stored.DashboardHidden ?? [])
            .Where(id => KnownDashboardSections.Contains(id, StringComparer.Ordinal))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        var more = (stored.NavMorePaths ?? [])
            .Where(p => KnownNavPaths.Contains(p))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        return new UserPreferencesDto(order, hidden, more);
    }

    private sealed class StoredPreferences
    {
        public List<string>? DashboardSectionOrder { get; set; }
        public List<string>? DashboardHidden { get; set; }
        public List<string>? NavMorePaths { get; set; }
    }
}

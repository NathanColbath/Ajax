using GameLibrary.Api.Data;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Entities;
using GameLibrary.Api.Mapping;
using Microsoft.EntityFrameworkCore;

namespace GameLibrary.Api.Services;

public class LocationsService(AppDbContext db, IAppEventLogger eventLogger)
{
    public async Task<IReadOnlyList<PhysicalLocationDto>> ListAsync(CancellationToken cancellationToken = default)
    {
        var locations = await db.Locations
            .OrderBy(l => l.Name)
            .ToListAsync(cancellationToken);

        return locations.Select(EntityMappers.ToDto).ToList();
    }

    public async Task<PhysicalLocationDto> CreateAsync(
        CreateLocationRequest request,
        CancellationToken cancellationToken = default)
    {
        var location = new PhysicalLocation
        {
            Id = $"loc{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            Name = request.Name.Trim(),
            Type = request.Type.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
        };

        db.Locations.Add(location);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Locations",
            EventType = "Created",
            Message = $"Location created: {location.Name}",
            EntityType = "Location",
            EntityId = location.Id,
        }, cancellationToken);

        return EntityMappers.ToDto(location);
    }

    public async Task<PhysicalLocationDto?> UpdateAsync(
        string id,
        UpdateLocationRequest request,
        CancellationToken cancellationToken = default)
    {
        var location = await db.Locations.FirstOrDefaultAsync(l => l.Id == id, cancellationToken);
        if (location is null)
        {
            return null;
        }

        var name = request.Name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new InvalidOperationException("Location name is required.");
        }

        location.Name = name;
        location.Type = string.IsNullOrWhiteSpace(request.Type) ? location.Type : request.Type.Trim();
        location.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Locations",
            EventType = "Updated",
            Message = $"Location updated: {location.Name}",
            EntityType = "Location",
            EntityId = location.Id,
        }, cancellationToken);

        return EntityMappers.ToDto(location);
    }

    public async Task<DeleteStatus> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var location = await db.Locations.FirstOrDefaultAsync(l => l.Id == id, cancellationToken);
        if (location is null)
        {
            return DeleteStatus.NotFound();
        }

        var hasItems = await db.PhysicalItems.AnyAsync(p => p.LocationId == id, cancellationToken);
        if (hasItems)
        {
            return DeleteStatus.Conflicted(
                $"Cannot delete {location.Name}: physical items still reference this location.");
        }

        var name = location.Name;
        db.Locations.Remove(location);
        await db.SaveChangesAsync(cancellationToken);

        await eventLogger.WriteAsync(new AppLogEvent
        {
            Category = "Locations",
            EventType = "Deleted",
            Message = $"Location deleted: {name}",
            EntityType = "Location",
            EntityId = id,
        }, cancellationToken);

        return DeleteStatus.Ok();
    }
}

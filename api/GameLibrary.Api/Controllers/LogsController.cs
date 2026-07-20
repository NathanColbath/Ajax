using GameLibrary.Api.Auth;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameLibrary.Api.Controllers;

[ApiController]
[Route("api/logs")]
public class LogsController(LogsService logsService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<IReadOnlyList<LogEntryDto>>> List(
        [FromQuery] long? afterId,
        [FromQuery] DateTimeOffset? since,
        [FromQuery] int? limit,
        [FromQuery] string? level,
        [FromQuery] string? category,
        [FromQuery] string? correlationId,
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        var results = await logsService.QueryAsync(
            new LogQueryDto(afterId, since, limit, level, category, correlationId, search),
            cancellationToken);
        return Ok(results);
    }

    [HttpGet("{id:long}")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<LogEntryDto>> GetById(long id, CancellationToken cancellationToken)
    {
        var entry = await logsService.GetByIdAsync(id, cancellationToken);
        return entry is null ? NotFound() : Ok(entry);
    }

    [HttpDelete("{id:long}")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult> Delete(long id, CancellationToken cancellationToken)
    {
        var result = await logsService.DeleteAsync(id, cancellationToken);
        return result.ToActionResult();
    }

    [HttpDelete]
    [Authorize(Policy = Policies.SuperAdminOnly)]
    public async Task<ActionResult<object>> Purge(
        [FromQuery] int olderThanDays = 30,
        CancellationToken cancellationToken = default)
    {
        var removed = await logsService.PurgeAsync(olderThanDays, cancellationToken);
        return Ok(new { removed });
    }
}

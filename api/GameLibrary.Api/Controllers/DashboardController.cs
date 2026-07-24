using GameLibrary.Api.Auth;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameLibrary.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Policy = Policies.Authenticated)]
public class DashboardController(DashboardService dashboardService) : ControllerBase
{
    [HttpGet("{userId}")]
    public async Task<ActionResult<DashboardSnapshotDto>> GetSnapshot(
        string userId,
        [FromQuery] int? recommendationSeed,
        CancellationToken cancellationToken)
    {
        var snapshot = await dashboardService.GetSnapshotAsync(userId, recommendationSeed, cancellationToken);
        return snapshot is null ? NotFound() : Ok(snapshot);
    }

    [HttpGet("{userId}/recommendations")]
    public async Task<ActionResult<IReadOnlyList<DashboardRecentGameDto>>> GetRecommendations(
        string userId,
        [FromQuery] int? seed,
        CancellationToken cancellationToken)
    {
        var items = await dashboardService.GetRecommendationsAsync(userId, seed, cancellationToken);
        return Ok(items);
    }
}

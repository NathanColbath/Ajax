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
        CancellationToken cancellationToken)
    {
        var snapshot = await dashboardService.GetSnapshotAsync(userId, cancellationToken);
        return snapshot is null ? NotFound() : Ok(snapshot);
    }
}

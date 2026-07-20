using GameLibrary.Api.Auth;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameLibrary.Api.Controllers;

[ApiController]
[Route("api/duplicates")]
[Authorize(Policy = Policies.Authenticated)]
public class DuplicatesController(DuplicatesService duplicatesService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DuplicateGroupDto>>> List(CancellationToken cancellationToken)
    {
        var groups = await duplicatesService.ListAsync(cancellationToken);
        return Ok(groups);
    }

    [HttpPost("{groupId}/keep")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<IReadOnlyList<DuplicateGroupDto>>> Keep(
        string groupId,
        [FromBody] KeepDuplicateRequest request,
        CancellationToken cancellationToken)
    {
        var groups = await duplicatesService.KeepAsync(groupId, request.FileId, cancellationToken);
        return Ok(groups);
    }

    [HttpPost("{groupId}/keep-both")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<IReadOnlyList<DuplicateGroupDto>>> KeepBoth(
        string groupId,
        CancellationToken cancellationToken)
    {
        var groups = await duplicatesService.KeepBothAsync(groupId, cancellationToken);
        return Ok(groups);
    }
}

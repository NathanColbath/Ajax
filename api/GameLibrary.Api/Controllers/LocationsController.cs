using GameLibrary.Api.Auth;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameLibrary.Api.Controllers;

[ApiController]
[Route("api/locations")]
[Authorize(Policy = Policies.Authenticated)]
public class LocationsController(LocationsService locationsService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PhysicalLocationDto>>> List(CancellationToken cancellationToken)
    {
        var locations = await locationsService.ListAsync(cancellationToken);
        return Ok(locations);
    }

    [HttpPost]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<PhysicalLocationDto>> Create(
        [FromBody] CreateLocationRequest request,
        CancellationToken cancellationToken)
    {
        var location = await locationsService.CreateAsync(request, cancellationToken);
        return Ok(location);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<PhysicalLocationDto>> Update(
        string id,
        [FromBody] UpdateLocationRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var location = await locationsService.UpdateAsync(id, request, cancellationToken);
            return location is null ? NotFound() : Ok(location);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var result = await locationsService.DeleteAsync(id, cancellationToken);
        return result.ToActionResult();
    }
}

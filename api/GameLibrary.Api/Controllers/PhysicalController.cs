using GameLibrary.Api.Auth;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameLibrary.Api.Controllers;

[ApiController]
[Route("api/physical")]
[Authorize(Policy = Policies.Authenticated)]
public class PhysicalController(PhysicalService physicalService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PhysicalItemDto>>> List(
        [FromQuery] string? locationId,
        CancellationToken cancellationToken)
    {
        var items = await physicalService.ListAsync(locationId, cancellationToken);
        return Ok(items);
    }

    [HttpGet("title-search")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<IReadOnlyList<PhysicalTitleSearchResultDto>>> TitleSearch(
        [FromQuery] string? q,
        [FromQuery] string? systemId,
        CancellationToken cancellationToken)
    {
        try
        {
            var results = await physicalService.SearchTitlesAsync(q, systemId, cancellationToken);
            return Ok(results);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<PhysicalItemDto>> Create(
        [FromBody] CreatePhysicalItemRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var item = await physicalService.CreateAsync(request, cancellationToken);
            return Ok(item);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<PhysicalItemDto>> Update(
        string id,
        [FromBody] UpdatePhysicalItemRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var item = await physicalService.UpdateAsync(id, request, cancellationToken);
            return item is null ? NotFound() : Ok(item);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/checkout")]
    public async Task<ActionResult<PhysicalItemDto>> ToggleCheckout(
        string id,
        [FromBody] CheckoutRequest? request,
        CancellationToken cancellationToken)
    {
        var item = await physicalService.ToggleCheckoutAsync(id, request?.Borrower, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var result = await physicalService.DeleteAsync(id, cancellationToken);
        return result.ToActionResult();
    }
}

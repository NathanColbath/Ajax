using GameLibrary.Api.Auth;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameLibrary.Api.Controllers;

[ApiController]
[Route("api/uploads")]
[Authorize(Policy = Policies.Authenticated)]
public class UploadsController(UploadsService uploadsService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UploadJobDto>>> List(CancellationToken cancellationToken)
    {
        var jobs = await uploadsService.ListAsync(cancellationToken);
        return Ok(jobs);
    }

    [HttpPost]
    [RequestSizeLimit(2_147_483_647)]
    public async Task<ActionResult<IReadOnlyList<UploadJobDto>>> Enqueue(
        [FromForm] IFormFileCollection files,
        [FromForm] string systemId,
        [FromForm] string? gameId,
        [FromForm] string? createTitle,
        CancellationToken cancellationToken)
    {
        try
        {
            var jobs = await uploadsService.EnqueueAsync(
                files, systemId, gameId, createTitle, cancellationToken);
            return Ok(jobs);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{id}/download")]
    public ActionResult Download(string id)
    {
        var result = uploadsService.Download(id);
        return result is null ? NotFound() : result;
    }

    [HttpPost("{id}/cancel")]
    public async Task<ActionResult<IReadOnlyList<UploadJobDto>>> Cancel(
        string id,
        CancellationToken cancellationToken)
    {
        var jobs = await uploadsService.CancelAsync(id, cancellationToken);
        return Ok(jobs);
    }

    [HttpPost("{id}/retry")]
    public async Task<ActionResult<IReadOnlyList<UploadJobDto>>> Retry(
        string id,
        CancellationToken cancellationToken)
    {
        var jobs = await uploadsService.RetryAsync(id, cancellationToken);
        return Ok(jobs);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var result = await uploadsService.DeleteAsync(id, cancellationToken);
        return result.ToActionResult();
    }
}

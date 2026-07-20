using GameLibrary.Api.Auth;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameLibrary.Api.Controllers;

[ApiController]
[Route("api/exports")]
[Authorize(Policy = Policies.AdminOrAbove)]
public class ExportsController(ExportsService exportsService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ExportJobDto>>> List(CancellationToken cancellationToken)
    {
        var jobs = await exportsService.ListJobsAsync(cancellationToken);
        return Ok(jobs);
    }

    [HttpPost]
    public async Task<ActionResult<IReadOnlyList<ExportJobDto>>> Run(
        [FromBody] RunExportRequest request,
        CancellationToken cancellationToken)
    {
        var jobs = await exportsService.RunAsync(request, cancellationToken);
        return Ok(jobs);
    }

    [HttpGet("{id}/download")]
    public ActionResult Download(string id)
    {
        var result = exportsService.Download(id);
        return result is null ? NotFound() : result;
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var result = await exportsService.DeleteAsync(id, cancellationToken);
        return result.ToActionResult();
    }
}

using GameLibrary.Api.Auth;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameLibrary.Api.Controllers;

[ApiController]
[Route("api/lists")]
[Authorize(Policy = Policies.Authenticated)]
public class GameListsController(GameListsService listsService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserGameListSummaryDto>>> List(
        CancellationToken cancellationToken)
    {
        var lists = await listsService.ListAsync(cancellationToken);
        return Ok(lists);
    }

    [HttpPost]
    public async Task<ActionResult<UserGameListSummaryDto>> Create(
        [FromBody] CreateUserGameListRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var list = await listsService.CreateAsync(request, cancellationToken);
            return Ok(list);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<UserGameListDetailDto>> GetById(
        string id,
        CancellationToken cancellationToken)
    {
        var list = await listsService.GetAsync(id, cancellationToken);
        return list is null ? NotFound() : Ok(list);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<UserGameListSummaryDto>> Rename(
        string id,
        [FromBody] UpdateUserGameListRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var list = await listsService.RenameAsync(id, request, cancellationToken);
            return list is null ? NotFound() : Ok(list);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var result = await listsService.DeleteAsync(id, cancellationToken);
        return result.ToActionResult();
    }

    [HttpPost("{id}/games")]
    public async Task<ActionResult<UserGameListDetailDto>> AddGame(
        string id,
        [FromBody] AddGameToListRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var list = await listsService.AddGameAsync(id, request, cancellationToken);
            return list is null ? NotFound() : Ok(list);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id}/games/{gameId}")]
    public async Task<ActionResult> RemoveGame(
        string id,
        string gameId,
        CancellationToken cancellationToken)
    {
        var result = await listsService.RemoveGameAsync(id, gameId, cancellationToken);
        return result.ToActionResult();
    }

    [HttpPost("{id}/download-jobs")]
    public async Task<ActionResult<GameListDownloadJobDto>> EnqueueDownload(
        string id,
        CancellationToken cancellationToken)
    {
        var job = await listsService.EnqueueDownloadAsync(id, cancellationToken);
        return job is null ? NotFound() : Ok(job);
    }

    [HttpGet("download-jobs")]
    public async Task<ActionResult<IReadOnlyList<GameListDownloadJobDto>>> ListDownloadJobs(
        CancellationToken cancellationToken)
    {
        var jobs = await listsService.ListDownloadJobsAsync(cancellationToken);
        return Ok(jobs);
    }

    [HttpGet("download-jobs/{jobId}/download")]
    public async Task<ActionResult> DownloadJob(string jobId, CancellationToken cancellationToken)
    {
        var result = await listsService.DownloadJobFileAsync(jobId, cancellationToken);
        return result is null ? NotFound() : result;
    }

    [HttpDelete("download-jobs/{jobId}")]
    public async Task<ActionResult> DeleteDownloadJob(string jobId, CancellationToken cancellationToken)
    {
        var result = await listsService.DeleteDownloadJobAsync(jobId, cancellationToken);
        return result.ToActionResult();
    }
}

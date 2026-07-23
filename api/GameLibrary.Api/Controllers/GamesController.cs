using GameLibrary.Api.Auth;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameLibrary.Api.Controllers;

[ApiController]
[Route("api/games")]
[Authorize(Policy = Policies.Authenticated)]
public class GamesController(GamesService gamesService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<GameSummaryDto>>> List(
        [FromQuery] string? search,
        [FromQuery] string? system,
        [FromQuery] bool? ownedOnly,
        CancellationToken cancellationToken)
    {
        var results = await gamesService.ListAsync(
            new GamesQueryDto(search, system, ownedOnly),
            cancellationToken);
        return Ok(results);
    }

    [HttpGet("systems")]
    public async Task<ActionResult<IReadOnlyList<string>>> Systems(CancellationToken cancellationToken)
    {
        var systems = await gamesService.GetSystemNamesAsync(cancellationToken);
        return Ok(systems);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<GameDetailDto>> GetById(string id, CancellationToken cancellationToken)
    {
        var game = await gamesService.GetByIdAsync(id, cancellationToken);
        return game is null ? NotFound() : Ok(game);
    }

    [HttpPatch("{id}")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<GameDetailDto>> Update(
        string id,
        [FromBody] UpdateGameRequest request,
        CancellationToken cancellationToken)
    {
        var game = await gamesService.UpdateAsync(id, request, cancellationToken);
        return game is null ? NotFound() : Ok(game);
    }

    [HttpGet("{id}/artwork/cover")]
    public async Task<ActionResult> GetCover(
        string id,
        [FromQuery] string? size,
        CancellationToken cancellationToken)
    {
        var result = await gamesService.GetCoverAsync(id, size, Response, cancellationToken);
        return result is null ? NotFound() : result;
    }

    [HttpPost("{id}/artwork/cover")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<GameDetailDto>> UploadCover(
        string id,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest("Cover image is required.");
        }

        try
        {
            var game = await gamesService.UploadCoverAsync(id, file, cancellationToken);
            return game is null ? NotFound() : Ok(game);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("{id}/artwork/cover")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<GameDetailDto>> DeleteCover(string id, CancellationToken cancellationToken)
    {
        var game = await gamesService.DeleteCoverAsync(id, cancellationToken);
        return game is null ? NotFound() : Ok(game);
    }

    [HttpGet("{id}/artwork/screenshots/{index:int}")]
    public async Task<ActionResult> GetScreenshot(string id, int index, CancellationToken cancellationToken)
    {
        var result = await gamesService.GetScreenshotAsync(id, index, Response, cancellationToken);
        return result is null ? NotFound() : result;
    }

    [HttpPost("{id}/artwork/screenshots")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<GameDetailDto>> UploadScreenshots(
        string id,
        [FromForm] IFormFileCollection files,
        CancellationToken cancellationToken)
    {
        if (files is null || files.Count == 0)
        {
            return BadRequest("At least one screenshot is required.");
        }

        try
        {
            var game = await gamesService.UploadScreenshotsAsync(id, files, cancellationToken);
            return game is null ? NotFound() : Ok(game);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("{id}/artwork/screenshots/{index:int}")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<GameDetailDto>> DeleteScreenshot(
        string id,
        int index,
        CancellationToken cancellationToken)
    {
        var game = await gamesService.DeleteScreenshotAsync(id, index, cancellationToken);
        return game is null ? NotFound() : Ok(game);
    }

    [HttpGet("{gameId}/files/{fileId}/download")]
    public async Task<ActionResult> DownloadFile(
        string gameId,
        string fileId,
        CancellationToken cancellationToken)
    {
        var result = await gamesService.DownloadFileAsync(gameId, fileId, cancellationToken);
        return result is null ? NotFound() : result;
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var result = await gamesService.DeleteAsync(id, cancellationToken);
        return result.ToActionResult();
    }

    [HttpDelete("{gameId}/files/{fileId}")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult> DeleteFile(
        string gameId,
        string fileId,
        CancellationToken cancellationToken)
    {
        var result = await gamesService.DeleteFileAsync(gameId, fileId, cancellationToken);
        return result.ToActionResult();
    }

    [HttpPost("{id}/favorite")]
    public async Task<ActionResult<GameDetailDto>> ToggleFavorite(string id, CancellationToken cancellationToken)
    {
        var game = await gamesService.ToggleFavoriteAsync(id, cancellationToken);
        return game is null ? NotFound() : Ok(game);
    }

    [HttpPost("{id}/play")]
    public async Task<IActionResult> RecordPlay(string id, CancellationToken cancellationToken)
    {
        var ok = await gamesService.RecordPlayAsync(id, cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpGet("{id}/reviews")]
    public async Task<ActionResult<IReadOnlyList<GameReviewDto>>> ListReviews(
        string id,
        CancellationToken cancellationToken)
    {
        var reviews = await gamesService.ListReviewsAsync(id, cancellationToken);
        return Ok(reviews);
    }

    [HttpPut("{id}/reviews")]
    public async Task<ActionResult<GameReviewDto>> UpsertReview(
        string id,
        [FromBody] UpsertGameReviewRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var review = await gamesService.UpsertReviewAsync(id, request, cancellationToken);
            return review is null ? NotFound() : Ok(review);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("{id}/reviews/me")]
    public async Task<ActionResult> DeleteMyReview(string id, CancellationToken cancellationToken)
    {
        var deleted = await gamesService.DeleteMyReviewAsync(id, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }

    [HttpGet("{id}/public-feedback")]
    public async Task<ActionResult<GamePublicFeedbackDto>> GetPublicFeedback(
        string id,
        CancellationToken cancellationToken)
    {
        var feedback = await gamesService.GetPublicFeedbackAsync(id, cancellationToken);
        return Ok(feedback);
    }
}


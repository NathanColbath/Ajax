using GameLibrary.Api.Auth;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameLibrary.Api.Controllers;

[ApiController]
[Route("api/systems")]
[Authorize(Policy = Policies.Authenticated)]
public class SystemsController(SystemsService systemsService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<GameSystemDto>>> List(CancellationToken cancellationToken)
    {
        var systems = await systemsService.ListAsync(cancellationToken);
        return Ok(systems);
    }

    [HttpGet("resolve-extension")]
    public async Task<ActionResult<IReadOnlyList<GameSystemDto>>> ResolveExtension(
        [FromQuery] string ext,
        CancellationToken cancellationToken)
    {
        var systems = await systemsService.ResolveByExtensionAsync(ext, cancellationToken);
        return Ok(systems);
    }

    [HttpPost]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<GameSystemDto>> Add(
        [FromBody] CreateGameSystemRequest request,
        CancellationToken cancellationToken)
    {
        var system = await systemsService.AddAsync(request, cancellationToken);
        return Ok(system);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<GameSystemDto>> Update(
        string id,
        [FromBody] UpdateGameSystemRequest request,
        CancellationToken cancellationToken)
    {
        var system = await systemsService.UpdateAsync(id, request, cancellationToken);
        return system is null ? NotFound() : Ok(system);
    }

    [HttpGet("{id}/artwork/logo")]
    public async Task<ActionResult> GetLogo(string id, CancellationToken cancellationToken)
    {
        var result = await systemsService.GetLogoAsync(id, Response, cancellationToken);
        return result is null ? NotFound() : result;
    }

    [HttpPost("{id}/artwork/logo")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<GameSystemDto>> UploadLogo(
        string id,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest("Logo image is required.");
        }

        try
        {
            var system = await systemsService.UploadLogoAsync(id, file, cancellationToken);
            return system is null ? NotFound() : Ok(system);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var result = await systemsService.DeleteAsync(id, cancellationToken);
        return result.ToActionResult();
    }

    [HttpPost("{id}/extensions")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<GameSystemDto>> AddExtension(
        string id,
        [FromBody] AddExtensionRequest request,
        CancellationToken cancellationToken)
    {
        var system = await systemsService.AddExtensionAsync(id, request.Extension, cancellationToken);
        return system is null ? NotFound() : Ok(system);
    }
}


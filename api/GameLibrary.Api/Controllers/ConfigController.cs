using GameLibrary.Api.Auth;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameLibrary.Api.Controllers;

[ApiController]
[Route("api/config")]
[Authorize(Policy = Policies.Authenticated)]
public class ConfigController(ConfigService configService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<SystemConfigDto>> GetSystemConfig(CancellationToken cancellationToken)
    {
        var config = await configService.GetSystemConfigAsync(cancellationToken);
        return Ok(config);
    }

    [HttpPut]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<SystemConfigDto>> UpdateSystemConfig(
        [FromBody] UpdateSystemConfigRequest patch,
        CancellationToken cancellationToken)
    {
        var config = await configService.UpdateSystemConfigAsync(patch, cancellationToken);
        return Ok(config);
    }

    [HttpGet("integrations")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public ActionResult<IntegrationsStatusDto> GetIntegrations()
    {
        return Ok(configService.GetIntegrationsStatus());
    }

    [HttpGet("storage")]
    [Authorize(Policy = Policies.SuperAdminOnly)]
    public async Task<ActionResult<StorageMetricsDto>> GetStorageMetrics(CancellationToken cancellationToken)
    {
        var metrics = await configService.GetStorageMetricsAsync(cancellationToken);
        return Ok(metrics);
    }

    [HttpPost("wipe")]
    [Authorize(Policy = Policies.SuperAdminOnly)]
    public async Task<ActionResult<FactoryWipeResultDto>> Wipe(CancellationToken cancellationToken)
    {
        try
        {
            var result = await configService.WipeAsync(cancellationToken);
            return Ok(result);
        }
        catch (WipeBusyException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}

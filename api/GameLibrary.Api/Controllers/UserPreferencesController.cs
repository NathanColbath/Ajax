using GameLibrary.Api.Auth;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameLibrary.Api.Controllers;

[ApiController]
[Route("api/users/me/preferences")]
[Authorize(Policy = Policies.Authenticated)]
public class UserPreferencesController(UserPreferencesService preferencesService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<UserPreferencesDto>> Get(CancellationToken cancellationToken)
    {
        var prefs = await preferencesService.GetAsync(cancellationToken);
        return prefs is null ? Unauthorized() : Ok(prefs);
    }

    [HttpPut]
    public async Task<ActionResult<UserPreferencesDto>> Update(
        [FromBody] UpdateUserPreferencesRequest request,
        CancellationToken cancellationToken)
    {
        var prefs = await preferencesService.UpdateAsync(request, cancellationToken);
        return prefs is null ? Unauthorized() : Ok(prefs);
    }
}

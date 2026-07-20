using GameLibrary.Api.Auth;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameLibrary.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Policy = Policies.AdminOrAbove)]
public class UsersController(UsersService usersService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<LibraryUserDto>>> List(CancellationToken cancellationToken)
    {
        var users = await usersService.ListAsync(cancellationToken);
        return Ok(users);
    }

    [HttpPost("{id}/toggle")]
    public async Task<ActionResult<LibraryUserDto>> ToggleEnabled(string id, CancellationToken cancellationToken)
    {
        var user = await usersService.ToggleEnabledAsync(id, cancellationToken);
        return user is null ? NotFound() : Ok(user);
    }

    [HttpPost]
    public async Task<ActionResult<LibraryUserDto>> Invite(
        [FromBody] InviteUserRequest request,
        CancellationToken cancellationToken)
    {
        var user = await usersService.InviteAsync(request, cancellationToken);
        return Ok(user);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var result = await usersService.DeleteAsync(id, cancellationToken);
        return result.ToActionResult();
    }
}

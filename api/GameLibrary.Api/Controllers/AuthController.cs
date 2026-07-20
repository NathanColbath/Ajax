using GameLibrary.Api.Auth;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameLibrary.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthService authService) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public IActionResult Login() =>
        Unauthorized(new { message = "Use Auth0 Universal Login. Password login is not supported." });

    [HttpGet("me")]
    [Authorize(Policy = Policies.Authenticated)]
    public async Task<ActionResult<AuthSessionDto>> Me(CancellationToken cancellationToken)
    {
        var session = await authService.GetSessionAsync(cancellationToken);
        return session is null ? Unauthorized() : Ok(session);
    }
}

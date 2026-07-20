using GameLibrary.Api.Services;

namespace GameLibrary.Api.Controllers;

internal static class DeleteResultExtensions
{
    public static Microsoft.AspNetCore.Mvc.ActionResult ToActionResult(this DeleteStatus result)
    {
        if (!result.Found)
        {
            return new Microsoft.AspNetCore.Mvc.NotFoundResult();
        }

        if (result.Conflict)
        {
            return new Microsoft.AspNetCore.Mvc.ConflictObjectResult(new { message = result.Message });
        }

        if (result.BadRequest)
        {
            return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(new { message = result.Message });
        }

        return new Microsoft.AspNetCore.Mvc.NoContentResult();
    }
}

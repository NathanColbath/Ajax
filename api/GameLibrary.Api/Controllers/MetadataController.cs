using GameLibrary.Api.Auth;
using GameLibrary.Api.Dtos;
using GameLibrary.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameLibrary.Api.Controllers;

[ApiController]
[Route("api/metadata")]
[Authorize(Policy = Policies.Authenticated)]
public class MetadataController(
    MetadataService metadataService,
    PublicEnrichmentService enrichmentService) : ControllerBase
{
    [HttpGet("providers")]
    public async Task<ActionResult<IReadOnlyList<MetadataProviderDto>>> ListProviders(
        CancellationToken cancellationToken)
    {
        var providers = await metadataService.ListProvidersAsync(cancellationToken);
        return Ok(providers);
    }

    [HttpGet("queue")]
    public async Task<ActionResult<IReadOnlyList<MetadataReviewItemDto>>> ListQueue(
        CancellationToken cancellationToken)
    {
        var queue = await metadataService.ListQueueAsync(cancellationToken);
        return Ok(queue);
    }

    [HttpGet("enrichment")]
    public async Task<ActionResult<PublicEnrichmentStatusDto>> GetEnrichment(
        CancellationToken cancellationToken)
    {
        var status = await enrichmentService.GetStatusAsync(cancellationToken);
        return Ok(status);
    }

    [HttpPost("enrichment/run")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<PublicEnrichmentStatusDto>> RunEnrichment(
        CancellationToken cancellationToken)
    {
        var status = await enrichmentService.RunAsync(cancellationToken);
        return Ok(status);
    }

    [HttpPost("providers/{id}/run")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<IReadOnlyList<MetadataProviderDto>>> RunProvider(
        string id,
        CancellationToken cancellationToken)
    {
        var providers = await metadataService.RunProviderAsync(id, cancellationToken);
        return Ok(providers);
    }

    [HttpPost("queue/accept-all")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<IReadOnlyList<MetadataReviewItemDto>>> AcceptAll(
        CancellationToken cancellationToken)
    {
        var queue = await metadataService.AcceptAllAsync(cancellationToken);
        return Ok(queue);
    }

    [HttpPost("queue/{id}/accept")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<IReadOnlyList<MetadataReviewItemDto>>> Accept(
        string id,
        CancellationToken cancellationToken)
    {
        var queue = await metadataService.AcceptAsync(id, cancellationToken);
        return Ok(queue);
    }

    [HttpPost("queue/{id}/skip")]
    [Authorize(Policy = Policies.AdminOrAbove)]
    public async Task<ActionResult<IReadOnlyList<MetadataReviewItemDto>>> Skip(
        string id,
        CancellationToken cancellationToken)
    {
        var queue = await metadataService.SkipAsync(id, cancellationToken);
        return Ok(queue);
    }
}

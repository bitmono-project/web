using BitMono.Web.Api.Jobs;
using BitMono.Web.Api.Models;
using BitMono.Web.Api.Storage;
using Hangfire;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BitMono.Web.Api.Controllers;

[ApiController]
[Route("obfuscate")]
public sealed class ObfuscateController(FileStore store, IBackgroundJobClient jobs) : ControllerBase
{
    private const long MaxUploadBytes = 30 * 1024 * 1024;

    [HttpPost]
    [EnableRateLimiting("obfuscate")]
    public async Task<IActionResult> Upload(IFormFile file, [FromForm] string[] protections, CancellationToken ct)
    {
        if (file.Length is 0 or > MaxUploadBytes)
            return BadRequest("File must be between 1 byte and 30 MB.");
        if (!file.FileName.EndsWith(".dll", StringComparison.OrdinalIgnoreCase) &&
            !file.FileName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            return BadRequest("Only .dll/.exe assemblies are accepted.");

        var selected = protections ?? [];

        var id = Guid.NewGuid();
        await using (var stream = file.OpenReadStream())
            await store.SaveInputAsync(id, stream, ct);

        // Protections are validated/defaulted by the obfuscation-service (single source of truth).
        jobs.Enqueue<ObfuscateJob>(j => j.RunAsync(id, file.FileName, selected, CancellationToken.None));
        return Accepted($"/obfuscate/{id}", new ObfuscateAcceptedResponse(id));
    }

    [HttpGet("{id:guid}")]
    public IActionResult Status(Guid id) =>
        Ok(new ObfuscateStatusResponse(id, store.Status(id)));

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id, string? name, CancellationToken ct)
    {
        var bytes = await store.TryReadOutputAsync(id, ct);
        if (bytes is null)
            return NotFound();
        store.DeleteOutput(id);
        return File(bytes, "application/octet-stream", name ?? $"{id:N}.dll");
    }
}

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
    private const long MaxUploadBytes = 100 * 1024 * 1024; // chunked upload assembles it under CF's per-request cap

    [HttpPost]
    [EnableRateLimiting("obfuscate")]
    public async Task<IActionResult> Upload(IFormFile file, [FromForm] string[] protections, [FromForm] bool agree, CancellationToken ct)
    {
        if (!agree)
            return BadRequest("You must confirm the assembly is yours to obfuscate and isn't malware.");
        if (file is null || file.Length is 0 or > MaxUploadBytes)
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

    // Chunked upload: the client PUTs the file in <CF-cap pieces to the same id, then finalizes.
    // No rate limit here (the size cap + the hourly cleanup sweep bound abuse); finalize is gated.
    [HttpPut("chunks/{id:guid}")]
    public async Task<IActionResult> UploadChunk(Guid id, CancellationToken ct)
    {
        if (store.InputSize(id) >= MaxUploadBytes)
            return BadRequest($"Upload exceeds {MaxUploadBytes / (1024 * 1024)} MB.");
        await store.AppendInputAsync(id, Request.Body, ct);
        if (store.InputSize(id) > MaxUploadBytes)
        {
            store.DeleteInput(id);
            return BadRequest($"Upload exceeds {MaxUploadBytes / (1024 * 1024)} MB.");
        }
        return NoContent();
    }

    [HttpPost("chunks/{id:guid}/finalize")]
    [EnableRateLimiting("obfuscate")]
    public IActionResult Finalize(Guid id, [FromForm] string fileName, [FromForm] string[] protections, [FromForm] bool agree)
    {
        if (!agree)
            return BadRequest("You must confirm the assembly is yours to obfuscate and isn't malware.");
        var size = store.InputSize(id);
        if (size is 0 or > MaxUploadBytes)
            return BadRequest($"File must be between 1 byte and {MaxUploadBytes / (1024 * 1024)} MB.");
        if (!fileName.EndsWith(".dll", StringComparison.OrdinalIgnoreCase) &&
            !fileName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
        {
            store.DeleteInput(id);
            return BadRequest("Only .dll/.exe assemblies are accepted.");
        }

        var selected = protections ?? [];
        jobs.Enqueue<ObfuscateJob>(j => j.RunAsync(id, fileName, selected, CancellationToken.None));
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

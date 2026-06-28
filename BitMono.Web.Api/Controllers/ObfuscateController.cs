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
    private const long Mb = 1024 * 1024;
    private const long MaxUploadBytes = 100 * Mb; // chunked upload assembles it under CF's per-request cap
    private const long MaxDependenciesBytes = 100 * Mb; // total across all dependency assemblies
    private const long MaxSigningKeyBytes = 64 * 1024; // .snk keys are ~1 KB; this is generous headroom

    private const string DllExtension = ".dll";
    private const string ExeExtension = ".exe";
    private const string SnkExtension = ".snk";

    private static bool IsAcceptedAssembly(string fileName) =>
        fileName.EndsWith(DllExtension, StringComparison.OrdinalIgnoreCase) ||
        fileName.EndsWith(ExeExtension, StringComparison.OrdinalIgnoreCase);

    private static bool HasExtension(string fileName, string extension) =>
        fileName.EndsWith(extension, StringComparison.OrdinalIgnoreCase);

    [HttpPost]
    [EnableRateLimiting("obfuscate")]
    public async Task<IActionResult> Upload(IFormFile file, [FromForm] string[] protections, [FromForm] bool agree, CancellationToken ct)
    {
        if (!agree)
            return BadRequest("You must confirm the assembly is yours to obfuscate and isn't malware.");
        if (file is null || file.Length is 0 or > MaxUploadBytes)
            return BadRequest($"File must be between 1 byte and {MaxUploadBytes / Mb} MB.");
        if (!IsAcceptedAssembly(file.FileName))
            return BadRequest($"Only {DllExtension}/{ExeExtension} assemblies are accepted.");

        var selected = protections ?? [];

        var id = Guid.NewGuid();
        await using (var stream = file.OpenReadStream())
            await store.SaveInputAsync(id, stream, ct);

        // Protections are validated/defaulted by the obfuscation-service (single source of truth).
        // Legacy single-shot path: no dependencies or signing key (the chunked finalize carries those).
        jobs.Enqueue<ObfuscateJob>(j => j.RunAsync(id, file.FileName, selected, Array.Empty<Guid>(), (Guid?)null, CancellationToken.None));
        return Accepted($"/obfuscate/{id}", new ObfuscateAcceptedResponse(id));
    }

    // Chunked upload: the client PUTs the file in <CF-cap pieces to the same id, then finalizes.
    // No rate limit here (the size cap + the hourly cleanup sweep bound abuse); finalize is gated.
    [HttpPut("chunks/{id:guid}")]
    public async Task<IActionResult> UploadChunk(Guid id, CancellationToken ct)
    {
        if (store.InputSize(id) >= MaxUploadBytes)
            return BadRequest($"Upload exceeds {MaxUploadBytes / Mb} MB.");
        await store.AppendInputAsync(id, Request.Body, ct);
        if (store.InputSize(id) > MaxUploadBytes)
        {
            store.DeleteInput(id);
            return BadRequest($"Upload exceeds {MaxUploadBytes / Mb} MB.");
        }
        return NoContent();
    }

    // Dependencies are chunk-uploaded under their own ids; the client lists those ids here. The
    // signing key is tiny, so it rides inline in this finalize form rather than a chunk stream.
    [HttpPost("chunks/{id:guid}/finalize")]
    [EnableRateLimiting("obfuscate")]
    public async Task<IActionResult> Finalize(
        Guid id,
        [FromForm] string fileName,
        [FromForm] string[] protections,
        [FromForm] bool agree,
        [FromForm] Guid[] dependencyIds,
        IFormFile? signingKey,
        CancellationToken ct)
    {
        var depIds = dependencyIds ?? [];
        void Cleanup()
        {
            store.DeleteInput(id);
            foreach (var depId in depIds)
                store.DeleteInput(depId);
        }

        if (!agree)
            return BadRequest("You must confirm the assembly is yours to obfuscate and isn't malware.");
        var size = store.InputSize(id);
        if (size is 0 or > MaxUploadBytes)
            return BadRequest($"File must be between 1 byte and {MaxUploadBytes / Mb} MB.");
        if (!IsAcceptedAssembly(fileName))
        {
            Cleanup();
            return BadRequest($"Only {DllExtension}/{ExeExtension} assemblies are accepted.");
        }

        // Keep only the dependencies that actually arrived and bound the total — they're auxiliary,
        // so a missing one isn't fatal (BitMono resolves references best-effort).
        var deps = depIds.Where(depId => store.InputSize(depId) > 0).ToArray();
        if (deps.Sum(store.InputSize) > MaxDependenciesBytes)
        {
            Cleanup();
            return BadRequest($"Dependencies must total under {MaxDependenciesBytes / Mb} MB.");
        }

        Guid? keyId = null;
        if (signingKey is { Length: > 0 })
        {
            if (!HasExtension(signingKey.FileName, SnkExtension))
            {
                Cleanup();
                return BadRequest($"The signing key must be a {SnkExtension} strong-name key file.");
            }
            if (signingKey.Length > MaxSigningKeyBytes)
            {
                Cleanup();
                return BadRequest($"The signing key must be under {MaxSigningKeyBytes / 1024} KB.");
            }
            keyId = Guid.NewGuid();
            await using var keyStream = signingKey.OpenReadStream();
            await store.SaveInputAsync(keyId.Value, keyStream, ct);
        }

        var selected = protections ?? [];
        jobs.Enqueue<ObfuscateJob>(j => j.RunAsync(id, fileName, selected, deps, keyId, CancellationToken.None));
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

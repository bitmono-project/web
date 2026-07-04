using BitMono.Web.Api.ReleaseFeed;
using BitMono.Web.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Controllers;

[ApiController]
public sealed class DownloadController(
    ReleaseCatalog catalog,
    IHttpClientFactory factory,
    CrackmesDbContext db,
    ILogger<DownloadController> logger) : ControllerBase
{
    // Stable, shareable download links. A bare slug resolves to the CURRENT release (e.g.
    // /download/cli/net8.0/win-x64); a version-scoped slug pins a specific one (/download/0.43.0/cli/…). We
    // stream the file through so the URL stays ours (clean) and we can count downloads — GitHub stays source of truth.
    [HttpGet("download/{**slug}")]
    [EnableRateLimiting("download")]
    public async Task<IActionResult> Get(string slug, CancellationToken ct)
    {
        var asset = await catalog.FindAsync(slug, ct);
        if (asset is null)
            return NotFound();

        var upstream = await factory.CreateClient("github").GetAsync(asset.SourceUrl, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!upstream.IsSuccessStatusCode)
        {
            logger.LogWarning("GitHub asset fetch failed ({Status}) for {Slug}", upstream.StatusCode, slug);
            upstream.Dispose();
            return StatusCode(StatusCodes.Status502BadGateway);
        }
        HttpContext.Response.RegisterForDispose(upstream);

        await IncrementAsync(slug, ct);   // key on the requested slug so each version counts on its own

        Response.Headers.CacheControl = "public, max-age=300";
        if (upstream.Content.Headers.ContentLength is { } len)
            Response.ContentLength = len;

        var stream = await upstream.Content.ReadAsStreamAsync(ct);
        return File(stream, "application/octet-stream", asset.Name);   // Content-Disposition: attachment; filename=…
    }

    // Atomic upsert-increment, keyed by the stable slug. Best-effort: a download must never fail because
    // analytics did, so any DB hiccup is logged and swallowed.
    private async Task IncrementAsync(string slug, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO "DownloadCounts" ("Key", "Count", "UpdatedAt")
                VALUES ({slug}, 1, {now})
                ON CONFLICT ("Key") DO UPDATE SET "Count" = "DownloadCounts"."Count" + 1, "UpdatedAt" = {now}
                """, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to record download for {Slug}", slug);
        }
    }
}

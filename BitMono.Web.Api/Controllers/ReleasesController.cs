using BitMono.Web.Api.Models;
using BitMono.Web.Api.ReleaseFeed;
using BitMono.Web.Data;
using BitMono.Web.Data.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Controllers;

[ApiController]
public sealed class ReleasesController(ReleaseCatalog catalog, CrackmesDbContext db) : ControllerBase
{
    // The latest release with every asset parsed into {kind, tfm, os, arch, unity…}, a stable proxy
    // DownloadUrl and its running download count. Kept for the SEO renderer and stable versionless links.
    [HttpGet("api/releases/latest")]
    public async Task<IActionResult> Latest(CancellationToken ct)
    {
        var data = await catalog.GetLatestAsync(ct);
        if (data is null)
            return StatusCode(StatusCodes.Status502BadGateway);

        var (counts, scans) = await LoadMetaAsync(ct);
        return Ok(BuildRelease(data, isLatest: true, counts, scans));
    }

    // Every downloadable release (>= MinVersion), newest first, each with its parsed assets — powers the
    // download page's version picker in a single fetch, so switching versions is instant and client-side.
    [HttpGet("api/releases")]
    public async Task<IActionResult> All(CancellationToken ct)
    {
        var all = await catalog.GetAllAsync(ct);
        if (all.Count == 0)
            return StatusCode(StatusCodes.Status502BadGateway);

        var (counts, scans) = await LoadMetaAsync(ct);
        var latest = all[0].Version;
        var releases = all.Select(r => BuildRelease(r, r.Version == latest, counts, scans)).ToList();
        return Ok(new ReleasesResponse(latest, releases));
    }

    // Download counts + VirusTotal verdicts are best-effort adornments — a DB hiccup must never blank the
    // download page, so we swallow it and fall back to empty maps.
    private async Task<(Dictionary<string, long> Counts, Dictionary<string, ReleaseScan> Scans)> LoadMetaAsync(CancellationToken ct)
    {
        Dictionary<string, long> counts = new();
        Dictionary<string, ReleaseScan> scans = new();
        try
        {
            counts = await db.DownloadCounts.ToDictionaryAsync(x => x.Key, x => x.Count, ct);
            scans = await db.ReleaseScans.ToDictionaryAsync(x => x.Sha256, ct);
        }
        catch { /* counts + scans are nice-to-haves; never fail the page over them */ }
        return (counts, scans);
    }

    // Latest keeps the stable versionless /download/cli/… links (and their existing download counts); older
    // releases get version-scoped /download/{version}/cli/… links so each version resolves and counts on its own.
    private static ReleaseResponse BuildRelease(
        ReleaseCatalogData data, bool isLatest,
        Dictionary<string, long> counts, Dictionary<string, ReleaseScan> scans)
    {
        var assets = data.Assets.Select(a =>
        {
            var slug = isLatest ? a.Slug : $"{data.Version}/{a.Slug}";
            return new ReleaseAsset(
                a.Kind, a.Name, a.Size, a.Sha256, "/download/" + slug, counts.GetValueOrDefault(slug),
                a.Tfm, a.Os, a.Arch, a.UnityVersion, a.UnityMajor, a.Format,
                a.Sha256 is not null && scans.TryGetValue(a.Sha256, out var s) ? new AssetScan(s.Status, s.Flagged, s.Total) : null);
        }).ToList();
        return new ReleaseResponse(data.Version, data.Tag, data.PublishedAt, data.HtmlUrl, assets);
    }
}

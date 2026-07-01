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
    // The guided download chooser reads this: the latest release plus every asset parsed into
    // {kind, tfm, os, arch, unity…} with a stable proxy DownloadUrl and its running download count.
    [HttpGet("api/releases/latest")]
    public async Task<IActionResult> Latest(CancellationToken ct)
    {
        var data = await catalog.GetAsync(ct);
        if (data is null)
            return StatusCode(StatusCodes.Status502BadGateway);

        Dictionary<string, long> counts = new();
        Dictionary<string, ReleaseScan> scans = new();
        try
        {
            counts = await db.DownloadCounts.ToDictionaryAsync(x => x.Key, x => x.Count, ct);
            scans = await db.ReleaseScans.ToDictionaryAsync(x => x.Sha256, ct);
        }
        catch { /* counts + scans are nice-to-haves; never fail the page over them */ }

        var assets = data.Assets.Select(a => new ReleaseAsset(
            a.Kind, a.Name, a.Size, a.Sha256, "/download/" + a.Slug, counts.GetValueOrDefault(a.Slug),
            a.Tfm, a.Os, a.Arch, a.UnityVersion, a.UnityMajor, a.Format,
            a.Sha256 is not null && scans.TryGetValue(a.Sha256, out var s) ? new AssetScan(s.Status, s.Flagged, s.Total) : null)).ToList();

        return Ok(new LatestReleaseResponse(data.Version, data.Tag, data.PublishedAt, data.HtmlUrl, assets));
    }
}

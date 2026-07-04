using System.Net;
using System.Net.Http.Json;
using BitMono.Web.Data;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.ReleaseFeed;

// Gets each release asset onto VirusTotal once, so the download page can show a live report + detection ratio
// instead of a dead /gui/file link. Runs as a throttled Hangfire job — the free public API allows 4 lookups/
// min, so we take a tiny batch per run and let the recurring schedule work through the assets over ~an hour.
// Gated on VirusTotal:ApiKey — no key, no-op (the page then falls back to the SHA-256 + a search link).
//
// We UPLOAD the file bytes (POST /files) rather than submit the URL (POST /urls): a URL submission doesn't
// reliably produce a by-hash file report, so GET /files/{sha} would 404 forever and every asset stayed
// "pending". Uploading makes the file immediately known to VT (GET returns 200, then last_analysis_stats
// populates once analysis finishes). Files over VT's 32 MB standard-upload cap are skipped (they keep the
// SHA-256 + search fallback). ponytail: skip >32 MB rather than add the large-file upload dance.
public sealed class VirusTotalScanner(
    IHttpClientFactory factory,
    CrackmesDbContext db,
    ReleaseCatalog catalog,
    IConfiguration cfg,
    ILogger<VirusTotalScanner> logger)
{
    private const int BatchPerRun = 1;                          // gentle: free tier is only 500 req/day total
    private const long MaxUploadBytes = 32L * 1024 * 1024;      // VT standard POST /files limit
    private static readonly TimeSpan Refresh = TimeSpan.FromDays(7);   // re-pull "done" verdicts weekly

    public async Task RunAsync(CancellationToken ct)
    {
        var key = cfg["VirusTotal:ApiKey"];
        if (string.IsNullOrWhiteSpace(key))
        {
            logger.LogDebug("VirusTotal scanning disabled (no VirusTotal:ApiKey).");
            return;
        }

        // Scan only the latest release's assets: older versions keep whatever verdict they earned while they
        // were latest, so we never re-spend the free-tier quota walking the whole back catalogue.
        var data = await catalog.GetLatestAsync(ct);
        if (data is null)
            return;

        var assets = data.Assets
            .Where(a => a.Sha256 is not null)
            .DistinctBy(a => a.Sha256)
            .ToList();
        var existing = await db.ReleaseScans.ToDictionaryAsync(x => x.Sha256, ct);
        var now = DateTime.UtcNow;

        // Work list: never scanned, still pending (analysis queued — re-check), or a stale "done" verdict.
        var todo = assets
            .Where(a => !existing.TryGetValue(a.Sha256!, out var e)
                        || e.Status == "pending"
                        || (e.Status == "done" && now - e.UpdatedAt > Refresh))
            .Take(BatchPerRun)
            .ToList();
        if (todo.Count == 0)
            return;

        var vt = factory.CreateClient("virustotal");
        var gh = factory.CreateClient("github");
        foreach (var a in todo)
        {
            ct.ThrowIfCancellationRequested();
            if (!await ScanOneAsync(vt, gh, a.Sha256!, a.SourceUrl, a.Size, ct))
                break;   // rate-limited — stop this run, the schedule resumes next time
        }
    }

    // Returns false when VT rate-limits us (so the caller stops the batch), true otherwise.
    private async Task<bool> ScanOneAsync(HttpClient vt, HttpClient gh, string sha, string url, long size, CancellationToken ct)
    {
        try
        {
            var res = await vt.GetAsync($"files/{sha}", ct);
            if (res.StatusCode == HttpStatusCode.TooManyRequests)
                return false;

            if (res.IsSuccessStatusCode)
            {
                var parsed = await res.Content.ReadFromJsonAsync<VtFileResponse>(ct);
                var stats = parsed?.data.attributes.last_analysis_stats ?? new Dictionary<string, int>();
                var flagged = stats.GetValueOrDefault("malicious") + stats.GetValueOrDefault("suspicious");
                var total = stats.Values.Sum();
                // total == 0 → VT knows the file but analysis is still queued; stay pending, re-check later.
                await UpsertAsync(sha, total > 0 ? "done" : "pending", flagged, total, ct);
                return true;
            }

            if (res.StatusCode != HttpStatusCode.NotFound)
            {
                logger.LogWarning("VirusTotal files/{Sha} returned {Status}", sha, res.StatusCode);
                return true;
            }

            // Unknown to VT → upload the bytes so it produces a real by-hash report. Skip over-cap files.
            if (size > MaxUploadBytes)
                return true;

            byte[] bytes;
            try { bytes = await gh.GetByteArrayAsync(url, ct); }
            catch (Exception ex) { logger.LogWarning(ex, "Fetch for VirusTotal upload failed for {Sha}", sha); return true; }

            using var form = new MultipartFormDataContent();
            form.Add(new ByteArrayContent(bytes), "file", sha);
            var post = await vt.PostAsync("files", form, ct);
            if (post.StatusCode == HttpStatusCode.TooManyRequests)
                return false;
            if (!post.IsSuccessStatusCode)
                logger.LogWarning("VirusTotal upload for {Sha} returned {Status}", sha, post.StatusCode);
            await UpsertAsync(sha, "pending", 0, 0, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "VirusTotal scan failed for {Sha}", sha);
        }
        return true;
    }

    private async Task UpsertAsync(string sha, string status, int flagged, int total, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "ReleaseScans" ("Sha256", "Status", "Flagged", "Total", "UpdatedAt")
            VALUES ({sha}, {status}, {flagged}, {total}, {now})
            ON CONFLICT ("Sha256") DO UPDATE SET
                "Status" = {status}, "Flagged" = {flagged}, "Total" = {total}, "UpdatedAt" = {now}
            """, ct);
    }

    // Typed shape of the slice of the VirusTotal /files/{id} response we read (snake_case matches the API;
    // web defaults are case-insensitive). last_analysis_stats maps each engine outcome → its count.
    private sealed record VtFileResponse(VtData data);
    private sealed record VtData(VtAttributes attributes);
    private sealed record VtAttributes(Dictionary<string, int> last_analysis_stats);
}

using System.Net;
using System.Text.Json;
using BitMono.Web.Data;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.ReleaseFeed;

// Submits each release asset to VirusTotal once, so the download page can show a live report + detection
// ratio instead of a dead /gui/file link. Runs as a throttled Hangfire job: the free public API allows
// 4 lookups/min, so we take a small batch per run and rely on the recurring schedule to work through the
// ~64 assets over a handful of minutes. Entirely gated on VirusTotal:ApiKey — no key, no-op (the page then
// falls back to the SHA-256 + a search link).
// ponytail: POST /urls hands VT the GitHub download URL to fetch+scan itself — no upload bandwidth and no
// 32 MB file-size cap. The file becomes queryable by hash a little later, resolved on a subsequent run.
public sealed class VirusTotalScanner(
    VirusTotalHttp virusTotal,
    CrackmesDbContext db,
    ReleaseCatalog catalog,
    IConfiguration cfg,
    ILogger<VirusTotalScanner> logger)
{
    private const int BatchPerRun = 4;                            // ~one minute's worth of the free quota
    private static readonly TimeSpan Refresh = TimeSpan.FromDays(7);   // re-pull "done" verdicts weekly

    public async Task RunAsync(CancellationToken ct)
    {
        var key = cfg["VirusTotal:ApiKey"];
        if (string.IsNullOrWhiteSpace(key))
        {
            logger.LogDebug("VirusTotal scanning disabled (no VirusTotal:ApiKey).");
            return;
        }

        var data = await catalog.GetAsync(ct);
        if (data is null)
            return;

        var assets = data.Assets
            .Where(a => a.Sha256 is not null)
            .DistinctBy(a => a.Sha256)
            .ToList();
        var existing = await db.ReleaseScans.ToDictionaryAsync(x => x.Sha256, ct);
        var now = DateTime.UtcNow;

        // Work list: never scanned, still pending (needs re-check), or a stale "done" verdict.
        var todo = assets
            .Where(a => !existing.TryGetValue(a.Sha256!, out var e)
                        || e.Status == "pending"
                        || (e.Status == "done" && now - e.UpdatedAt > Refresh))
            .Take(BatchPerRun)
            .ToList();
        if (todo.Count == 0)
            return;

        var client = virusTotal.Client;
        foreach (var a in todo)
        {
            ct.ThrowIfCancellationRequested();
            if (!await ScanOneAsync(client, a.Sha256!, a.SourceUrl, ct))
                break;   // rate-limited — stop this run, the schedule picks it back up
        }
    }

    // Returns false when VT rate-limits us (so the caller stops the batch), true otherwise.
    private async Task<bool> ScanOneAsync(HttpClient client, string sha, string url, CancellationToken ct)
    {
        try
        {
            var res = await client.GetAsync($"files/{sha}", ct);
            if (res.StatusCode == HttpStatusCode.TooManyRequests)
                return false;

            if (res.IsSuccessStatusCode)
            {
                using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
                var stats = doc.RootElement.GetProperty("data").GetProperty("attributes").GetProperty("last_analysis_stats");
                var flagged = stats.GetProperty("malicious").GetInt32() + stats.GetProperty("suspicious").GetInt32();
                var total = 0;
                foreach (var p in stats.EnumerateObject())
                    total += p.Value.GetInt32();
                await UpsertAsync(sha, "done", flagged, total, ct);
            }
            else if (res.StatusCode == HttpStatusCode.NotFound)
            {
                // Unknown to VT — ask it to fetch + scan the GitHub URL, then mark pending for a later re-check.
                using var form = new FormUrlEncodedContent(new Dictionary<string, string> { ["url"] = url });
                var sub = await client.PostAsync("urls", form, ct);
                if (sub.StatusCode == HttpStatusCode.TooManyRequests)
                    return false;
                await UpsertAsync(sha, "pending", 0, 0, ct);
            }
            else
            {
                logger.LogWarning("VirusTotal files/{Sha} returned {Status}", sha, res.StatusCode);
            }
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
}

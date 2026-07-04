using System.Net.Http.Json;
using BitMono.Web.Api.Models;
using Microsoft.Extensions.Caching.Memory;

namespace BitMono.Web.Api.ReleaseFeed;

// Parsed asset with the bits the proxy needs: the stable Slug (proxy path + counter key) and the GitHub
// SourceUrl we stream from. Public-facing shape (with download counts) is ReleaseAsset in Models.
public sealed record CatalogAsset(
    ReleaseAssetKind Kind, string Slug, string Name, long Size, string? Sha256, string SourceUrl,
    string? Tfm, string? Os, string? Arch, string? UnityVersion, string? UnityMajor, string? Format);

public sealed record ReleaseCatalogData(
    string Version, string Tag, DateTimeOffset PublishedAt, string HtmlUrl, IReadOnlyList<CatalogAsset> Assets);

// Fetches bitmono-project/BitMono's downloadable releases from the GitHub API, parses each release's asset
// names into a structured catalog, and caches the lot. GitHub's unauthenticated limit is 60 req/hr per IP,
// so without this every page load would burn one — here GitHub sees ~2 calls/hour regardless of traffic. On
// a fetch failure (rate-limit, outage) we serve the last good catalog so the download page never goes dark.
// ponytail: per-replica IMemoryCache — a couple of replicas means a couple of GitHub calls/hr, still far
// under the limit. Move to a distributed cache only if replica count ever balloons.
public sealed class ReleaseCatalog(IHttpClientFactory factory, IMemoryCache cache, ILogger<ReleaseCatalog> logger)
{
    private const string Repo = "bitmono-project/BitMono";
    private const string CacheKey = "release:catalog";
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(30);

    // Oldest release we offer for download. Pre-0.43.0 builds are excluded on purpose: they're old, and
    // VirusTotal-scanning that many extra assets would blow the free-tier quota. Bump to drop more versions.
    public static readonly Version MinVersion = new(0, 43, 0);

    private readonly SemaphoreSlim _lock = new(1, 1);
    private IReadOnlyList<ReleaseCatalogData>? _lastGood;
    private DateTime _cooldownUntil = DateTime.MinValue;

    // Every downloadable release (>= MinVersion), newest first. Cached; serves last-good on a fetch failure.
    public async Task<IReadOnlyList<ReleaseCatalogData>> GetAllAsync(CancellationToken ct)
    {
        if (cache.TryGetValue(CacheKey, out IReadOnlyList<ReleaseCatalogData>? cached))
            return cached ?? [];

        await _lock.WaitAsync(ct);
        try
        {
            if (cache.TryGetValue(CacheKey, out cached))
                return cached ?? [];

            // Back off after a failure so a broken/rate-limited GitHub isn't hammered on every request
            // (which is how the unauthenticated 60/hr limit got exhausted in the first place).
            if (DateTime.UtcNow < _cooldownUntil)
                return _lastGood ?? [];

            var fresh = await FetchAsync(ct);
            if (fresh is not null)
            {
                _lastGood = fresh;
                cache.Set(CacheKey, fresh, Ttl);
                return fresh;
            }
            _cooldownUntil = DateTime.UtcNow.AddMinutes(1);
            return _lastGood ?? [];   // GitHub unreachable / rate-limited → last good beats a broken page
        }
        finally
        {
            _lock.Release();
        }
    }

    // The latest downloadable release (highest version), or null if the feed is empty/unreachable.
    public async Task<ReleaseCatalogData?> GetLatestAsync(CancellationToken ct)
    {
        var all = await GetAllAsync(ct);
        return all.Count > 0 ? all[0] : null;
    }

    // Resolves a /download slug to its asset. "{version}/cli/net8.0/win/x64" → that specific release; a bare
    // "cli/net8.0/win/x64" (our stable versionless link) → the latest release.
    public async Task<CatalogAsset?> FindAsync(string slug, CancellationToken ct)
    {
        var all = await GetAllAsync(ct);
        if (all.Count == 0)
            return null;

        var slash = slug.IndexOf('/');
        if (slash > 0)
        {
            var byVersion = all.FirstOrDefault(r => r.Version == slug[..slash]);
            if (byVersion is not null)
                return byVersion.Assets.FirstOrDefault(a => a.Slug == slug[(slash + 1)..]);
        }
        return all[0].Assets.FirstOrDefault(a => a.Slug == slug);
    }

    private async Task<IReadOnlyList<ReleaseCatalogData>?> FetchAsync(CancellationToken ct)
    {
        try
        {
            var gh = await factory.CreateClient("github")
                .GetFromJsonAsync<GhRelease[]>($"repos/{Repo}/releases?per_page=100", ct);
            if (gh is null)
                return null;

            return gh
                .Where(r => !r.draft && !r.prerelease)
                .Select(r => (release: r, version: ParseVersion(r.tag_name)))
                .Where(x => x.version is not null && x.version >= MinVersion)
                .OrderByDescending(x => x.version)
                .Select(x => new ReleaseCatalogData(
                    x.version!.ToString(), x.release.tag_name, x.release.published_at, x.release.html_url,
                    x.release.assets
                        .Select(a => ReleaseAssets.Parse(a.name, a.size, a.digest, a.browser_download_url))
                        .OfType<CatalogAsset>()
                        .ToList()))
                .ToList();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to fetch BitMono releases from GitHub.");
            return null;
        }
    }

    // Parses a release tag ("0.43.0", "v0.42.1", "v0.22.0-alpha.39") to a comparable Version, or null if it
    // isn't a plain x.y.z — strips a leading v and any -prerelease/+build suffix before parsing.
    public static Version? ParseVersion(string tag)
    {
        var s = tag.TrimStart('v', 'V');
        var cut = s.IndexOfAny(['-', '+']);
        if (cut >= 0)
            s = s[..cut];
        return Version.TryParse(s, out var v) ? v : null;
    }

    // Minimal projection of the GitHub release JSON (snake_case matches the API; web defaults are case-insensitive).
    private sealed record GhRelease(string tag_name, DateTimeOffset published_at, string html_url, bool draft, bool prerelease, GhAsset[] assets);
    private sealed record GhAsset(string name, long size, string? digest, string browser_download_url);
}

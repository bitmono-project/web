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

// Fetches bitmono-project/BitMono's latest release from the GitHub API, parses the asset names into a
// structured catalog, and caches it. GitHub's unauthenticated limit is 60 req/hr per IP, so without this
// every page load would burn one — here GitHub sees ~2 calls/hour regardless of traffic. On a fetch
// failure (rate-limit, outage) we serve the last good catalog so the download page never goes dark.
// ponytail: per-replica IMemoryCache — a couple of replicas means a couple of GitHub calls/hr, still far
// under the limit. Move to a distributed cache only if replica count ever balloons.
public sealed class ReleaseCatalog(IHttpClientFactory factory, IMemoryCache cache, ILogger<ReleaseCatalog> logger)
{
    private const string Repo = "bitmono-project/BitMono";
    private const string CacheKey = "release:latest";
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(30);

    private readonly SemaphoreSlim _lock = new(1, 1);
    private ReleaseCatalogData? _lastGood;

    public async Task<ReleaseCatalogData?> GetAsync(CancellationToken ct)
    {
        if (cache.TryGetValue(CacheKey, out ReleaseCatalogData? cached))
            return cached;

        await _lock.WaitAsync(ct);
        try
        {
            if (cache.TryGetValue(CacheKey, out cached))
                return cached;

            var fresh = await FetchAsync(ct);
            if (fresh is not null)
            {
                _lastGood = fresh;
                cache.Set(CacheKey, fresh, Ttl);
                return fresh;
            }
            return _lastGood;   // GitHub unreachable / rate-limited → last good beats a broken page
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<CatalogAsset?> FindAsync(string slug, CancellationToken ct)
    {
        var data = await GetAsync(ct);
        return data?.Assets.FirstOrDefault(a => a.Slug == slug);
    }

    private async Task<ReleaseCatalogData?> FetchAsync(CancellationToken ct)
    {
        try
        {
            var client = factory.CreateClient("github");
            var gh = await client.GetFromJsonAsync<GhRelease>($"repos/{Repo}/releases/latest", ct);
            if (gh is null)
                return null;

            var version = gh.tag_name.TrimStart('v');
            var assets = gh.assets
                .Select(a => ReleaseAssets.Parse(a.name, a.size, a.digest, a.browser_download_url))
                .OfType<CatalogAsset>()
                .ToList();
            return new ReleaseCatalogData(version, gh.tag_name, gh.published_at, gh.html_url, assets);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to fetch the latest BitMono release from GitHub.");
            return null;
        }
    }

    // Minimal projection of the GitHub release JSON (snake_case matches the API; web defaults are case-insensitive).
    private sealed record GhRelease(string tag_name, DateTimeOffset published_at, string html_url, GhAsset[] assets);
    private sealed record GhAsset(string name, long size, string? digest, string browser_download_url);
}

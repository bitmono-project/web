namespace BitMono.Web.Api.Models;

// The three shapes BitMono ships per release. Kind is the real branching type (enum, per house style);
// tfm/os/arch/format stay strings — the valid set is whatever GitHub actually publishes, and the proxy
// enforces it by resolving against the live asset list (a 404 for anything that doesn't exist beats an
// enum that can name a build we never shipped). ponytail: strings validated by asset lookup, not enums.
public enum ReleaseAssetKind { Cli, UnityPackage, UnityUpm }

public sealed record ReleaseAsset(
    ReleaseAssetKind Kind,
    string Name,
    long Size,
    string? Sha256,
    string DownloadUrl,   // our stable proxy path, e.g. /download/cli/net8.0/win-x64
    long Downloads,
    string? Tfm = null,
    string? Os = null,
    string? Arch = null,
    string? UnityVersion = null,   // full, e.g. 2022.3.29f1
    string? UnityMajor = null,     // e.g. 2022 / 6000
    string? Format = null,         // unitypackage | upm
    AssetScan? Vt = null);         // VirusTotal result, once the scan job has run (null = not scanned yet)

// VirusTotal verdict for an asset. Status "done" → Flagged/Total are meaningful (e.g. 0/72); "pending" →
// submitted, awaiting analysis. Absent entirely when scanning is off (no API key) or the file is brand new.
public sealed record AssetScan(string Status, int Flagged, int Total);

public sealed record ReleaseResponse(
    string Version,
    string Tag,
    DateTimeOffset PublishedAt,
    string HtmlUrl,
    IReadOnlyList<ReleaseAsset> Assets);

// All downloadable releases (>= ReleaseCatalog.MinVersion), newest first, with the latest version called out
// so the picker can badge it. Powers the download page's version selector in a single fetch.
public sealed record ReleasesResponse(string Latest, IReadOnlyList<ReleaseResponse> Releases);

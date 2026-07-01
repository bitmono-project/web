using System.Text.RegularExpressions;
using BitMono.Web.Api.Models;

namespace BitMono.Web.Api.ReleaseFeed;

// Parses a GitHub release asset name into a structured CatalogAsset. Pulled out of ReleaseCatalog so the
// regex logic — the riskiest part of the feature — is a pure function that can be unit-tested without any
// HTTP/cache/DI. Returns null for anything that isn't a recognised BitMono build (checksums, source zips,
// a future asset kind), so unknown shapes are skipped instead of breaking the catalog.
public static class ReleaseAssets
{
    // BitMono-v0.43.0+5778b175-CLI-net8.0-win-x64.zip
    private static readonly Regex CliRe = new(
        @"^BitMono-v(?<ver>[^+]+)\+[^-]+-CLI-(?<tfm>net\d+\.\d+|net\d{3}|netstandard\d\.\d)-(?<os>win|linux|osx)-(?<arch>x64|x86|arm64)\.zip$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);
    // BitMono-Unity-v0.43.0+5778b175-Unity2022.3.29f1.unitypackage
    private static readonly Regex UnityPkgRe = new(
        @"^BitMono-Unity-v(?<ver>[^+]+)\+[^-]+-Unity(?<uver>.+)\.unitypackage$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);
    // BitMono-Unity-UPM-v0.43.0+5778b175-Unity2022.3.29f1.tgz
    private static readonly Regex UnityUpmRe = new(
        @"^BitMono-Unity-UPM-v(?<ver>[^+]+)\+[^-]+-Unity(?<uver>.+)\.tgz$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static CatalogAsset? Parse(string name, long size, string? digest, string url)
    {
        var sha = digest?.StartsWith("sha256:", StringComparison.OrdinalIgnoreCase) == true
            ? digest["sha256:".Length..]
            : null;

        var cli = CliRe.Match(name);
        if (cli.Success)
        {
            var tfm = cli.Groups["tfm"].Value.ToLowerInvariant();
            var os = cli.Groups["os"].Value.ToLowerInvariant();
            var arch = cli.Groups["arch"].Value.ToLowerInvariant();
            return new CatalogAsset(ReleaseAssetKind.Cli, $"cli/{tfm}/{os}/{arch}", name, size, sha, url,
                tfm, os, arch, null, null, null);
        }

        var pkg = UnityPkgRe.Match(name);
        if (pkg.Success)
        {
            var uver = pkg.Groups["uver"].Value;
            var major = uver.Split('.')[0];
            return new CatalogAsset(ReleaseAssetKind.UnityPackage, $"unity/{major}/unitypackage", name, size, sha, url,
                null, null, null, uver, major, "unitypackage");
        }

        var upm = UnityUpmRe.Match(name);
        if (upm.Success)
        {
            var uver = upm.Groups["uver"].Value;
            var major = uver.Split('.')[0];
            return new CatalogAsset(ReleaseAssetKind.UnityUpm, $"unity/{major}/upm", name, size, sha, url,
                null, null, null, uver, major, "upm");
        }

        return null;
    }
}

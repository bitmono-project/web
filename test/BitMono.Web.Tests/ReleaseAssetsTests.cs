using BitMono.Web.Api.Models;
using BitMono.Web.Api.Releases;

namespace BitMono.Web.Tests;

// Pure parser checks over the real 0.43.0 asset names — no HTTP, cache or DI. Guards the slug shape the
// /download proxy resolves against and the {tfm, os, arch, unity} fields the chooser filters on.
public class ReleaseAssetsTests
{
    [Theory]
    [InlineData("BitMono-v0.43.0+5778b175-CLI-net8.0-win-x64.zip", "cli/net8.0/win/x64", "net8.0", "win", "x64")]
    [InlineData("BitMono-v0.43.0+5778b175-CLI-net10.0-osx-arm64.zip", "cli/net10.0/osx/arm64", "net10.0", "osx", "arm64")]
    [InlineData("BitMono-v0.43.0+5778b175-CLI-net462-win-x86.zip", "cli/net462/win/x86", "net462", "win", "x86")]
    [InlineData("BitMono-v0.43.0+5778b175-CLI-netstandard2.0-linux-x64.zip", "cli/netstandard2.0/linux/x64", "netstandard2.0", "linux", "x64")]
    public void Parses_cli_builds(string name, string slug, string tfm, string os, string arch)
    {
        var a = ReleaseAssets.Parse(name, 123, "sha256:deadbeef", "https://example/dl");

        Assert.NotNull(a);
        Assert.Equal(ReleaseAssetKind.Cli, a!.Kind);
        Assert.Equal(slug, a.Slug);
        Assert.Equal(tfm, a.Tfm);
        Assert.Equal(os, a.Os);
        Assert.Equal(arch, a.Arch);
        Assert.Equal("deadbeef", a.Sha256);   // "sha256:" prefix stripped
        Assert.Equal(123, a.Size);
    }

    [Theory]
    [InlineData("BitMono-Unity-v0.43.0+5778b175-Unity2022.3.29f1.unitypackage", "unity/2022/unitypackage", "2022.3.29f1", "2022")]
    [InlineData("BitMono-Unity-v0.43.0+5778b175-Unity6000.0.2f1.unitypackage", "unity/6000/unitypackage", "6000.0.2f1", "6000")]
    public void Parses_unity_packages(string name, string slug, string unityVersion, string major)
    {
        var a = ReleaseAssets.Parse(name, 1, null, "u");

        Assert.NotNull(a);
        Assert.Equal(ReleaseAssetKind.UnityPackage, a!.Kind);
        Assert.Equal(slug, a.Slug);
        Assert.Equal(unityVersion, a.UnityVersion);
        Assert.Equal(major, a.UnityMajor);
        Assert.Equal("unitypackage", a.Format);
        Assert.Null(a.Sha256);   // no digest → no hash
    }

    [Fact]
    public void Parses_unity_upm()
    {
        var a = ReleaseAssets.Parse("BitMono-Unity-UPM-v0.43.0+5778b175-Unity2021.3.45f1.tgz", 1, null, "u");

        Assert.NotNull(a);
        Assert.Equal(ReleaseAssetKind.UnityUpm, a!.Kind);
        Assert.Equal("unity/2021/upm", a.Slug);
        Assert.Equal("upm", a.Format);
    }

    [Theory]
    [InlineData("checksums.txt")]
    [InlineData("Source code (zip)")]
    [InlineData("BitMono-v0.43.0-CLI-net8.0-win-x64.zip")]   // no +hash → not our shape
    public void Skips_unknown_shapes(string name) =>
        Assert.Null(ReleaseAssets.Parse(name, 1, null, "u"));
}

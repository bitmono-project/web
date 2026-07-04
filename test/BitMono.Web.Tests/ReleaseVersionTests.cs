using BitMono.Web.Api.ReleaseFeed;

namespace BitMono.Web.Tests;

// Guards the download-version floor: which release tags parse and clear MinVersion (0.43.0). Pre-0.43.0 and
// prerelease/garbage tags must be excluded so the picker never offers a build we don't want to VirusTotal-scan.
public class ReleaseVersionTests
{
    [Theory]
    [InlineData("0.43.0", true)]
    [InlineData("v0.43.0", true)]
    [InlineData("0.44.2", true)]
    [InlineData("1.0.0", true)]
    [InlineData("0.42.1", false)]      // below the floor
    [InlineData("v0.23.13", false)]
    [InlineData("v0.22.0-alpha.39", false)]   // prerelease suffix + below floor
    [InlineData("nightly", false)]     // not a version at all
    public void MinVersion_gate(string tag, bool selectable)
    {
        var v = ReleaseCatalog.ParseVersion(tag);
        Assert.Equal(selectable, v is not null && v >= ReleaseCatalog.MinVersion);
    }
}

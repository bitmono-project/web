using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// Per-asset download tally for the release proxy (/download/…). Keyed by the STABLE slug
// (e.g. "cli/net8.0/win-x64"), never the versioned asset name, so counts survive releases.
public class DownloadCount
{
    [Key, MaxLength(128)] public string Key { get; set; } = null!;
    public long Count { get; set; }
    public DateTime UpdatedAt { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// VirusTotal result for a release asset, keyed by the file's SHA-256 (VT is per-hash, and the hash dedupes
// across the many per-RID slugs that share a build). Populated by the VirusTotalScanner background job which
// submits each asset once per release; the download page reads it for a live report link + detection ratio.
public class ReleaseScan
{
    [Key, MaxLength(64)] public string Sha256 { get; set; } = null!;
    public ScanStatus Status { get; set; } = ScanStatus.Pending;
    public int Flagged { get; set; }   // malicious + suspicious engine hits
    public int Total { get; set; }     // engines that returned a verdict
    public DateTime UpdatedAt { get; set; }
}

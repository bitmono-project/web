using BitMono.Web.Data;

namespace BitMono.Web.Api.Models;

public sealed record ReportRequest(string Reason, string? Details);

// One queue row for any reportable target. Crackme reports carry CrackmeSlug/Title; profile
// reports carry TargetHandle/TargetName instead.
public sealed record PendingReport(
    Guid Id, ModeratableType TargetType,
    string? CrackmeSlug, string? CrackmeTitle,
    string? TargetHandle, string? TargetName,
    ReportReason Reason, string? Details,
    string Reporter, string? ReporterHandle, DateTime CreatedAt);

public sealed record BioHideRequest(string? Reason);

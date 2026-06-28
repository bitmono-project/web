using BitMono.Web.Data;

namespace BitMono.Web.Api.Models;

public sealed record ReportRequest(string Reason, string? Details);

public sealed record PendingReport(
    Guid Id, string CrackmeSlug, string CrackmeTitle, ReportReason Reason, string? Details,
    string Reporter, string? ReporterHandle, DateTime CreatedAt);

using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// Public "report this" flag → feeds the moderation queue. Distinct from ModerationReview (a mod action).
public class Report
{
    [Key] public Guid Id { get; set; }

    public ModeratableType TargetType { get; set; }
    public Guid TargetId { get; set; }
    public Guid? CrackmeId { get; set; }
    public Crackme? Crackme { get; set; }

    public Guid? ReporterUserId { get; set; }
    [MaxLength(45)] public string? ReporterIp { get; set; }

    public ReportReason Reason { get; set; }
    [MaxLength(2000)] public string? Details { get; set; }

    public bool IsResolved { get; set; }
    public Guid? ResolvedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// Append-only audit trail (mirrors Safeturned's FileAdminReview), generalized over content type.
public class ModerationReview
{
    [Key] public Guid Id { get; set; }

    public ModeratableType TargetType { get; set; }
    public Guid TargetId { get; set; } // polymorphic id

    // Set when TargetType == Crackme so we get the real FK + cascade + nav.
    public Guid? CrackmeId { get; set; }
    public Crackme? Crackme { get; set; }

    public Guid ReviewerId { get; set; } // FK to User added with auth
    public ModerationVerdict Verdict { get; set; }
    [MaxLength(2000)] public string? PublicMessage { get; set; }
    [MaxLength(4000)] public string? InternalNotes { get; set; }
    [MaxLength(1000)] public string? TakedownReason { get; set; }
    public bool IsTakedown { get; set; }

    public DateTime CreatedAt { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// An author-written hint on a crackme. Unlocking one costs the solver a % of the points they'd earn
// (the biggest unlocked cost wins) — the penalty is locked into Solve.PointsAwarded at solve time.
public class CrackmeHint
{
    [Key] public Guid Id { get; set; }

    public Guid CrackmeId { get; set; }
    public Crackme Crackme { get; set; } = null!;

    public int Order { get; set; }                       // display order, 0-based
    [Required, MaxLength(2000)] public string Body { get; set; } = null!;
    public int CostPercent { get; set; }                 // 5..75 — how much of the solve it shaves off

    public DateTime CreatedAt { get; set; }
}

// One row per (user, hint) the user has revealed. The crackme is denormalized so the solve path can
// find "max cost this user unlocked on this crackme" in one query.
public class HintUnlock
{
    [Key] public Guid Id { get; set; }

    public Guid HintId { get; set; }
    public Guid CrackmeId { get; set; }
    public Guid UserId { get; set; }
    public int CostPercent { get; set; }                 // snapshot of the hint's cost when unlocked
    public DateTime UnlockedAt { get; set; }
}

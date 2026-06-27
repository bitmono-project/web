using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// One row per (user, crackme) they've solved — the authoritative fact. Crackme.SolvedCount and
// User.Points are denormalized caches kept in the same transaction (like the download counter).
// Bare Guids, no navs (mirrors Reaction) — insert-only, immune to cascade surprises.
public class Solve
{
    [Key] public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public Guid CrackmeId { get; set; }
    public SolveSource Source { get; set; }

    // Locked at solve time so the leaderboard just SUMs a column instead of recomputing decay.
    public int PointsAwarded { get; set; }
    public bool IsFirstBlood { get; set; }
    public DateTime SolvedAt { get; set; }
}

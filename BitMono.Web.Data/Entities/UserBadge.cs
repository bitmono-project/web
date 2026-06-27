using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// Ledger of awarded badges — one row per (user, badge), kept (not computed) so AwardedAt and
// path-dependent badges (first blood, bitmonoed) survive. Bare Guids like Reaction.
public class UserBadge
{
    [Key] public Guid Id { get; set; }

    public Guid UserId { get; set; }
    [Required, MaxLength(40)] public string BadgeCode { get; set; } = null!;
    public DateTime AwardedAt { get; set; }
}

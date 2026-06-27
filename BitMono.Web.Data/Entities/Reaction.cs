using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// An emoji reaction on a crackme post or a comment. One row per (target, user, emoji).
// TargetType is Crackme or Comment (reuses ModeratableType).
public class Reaction
{
    [Key] public Guid Id { get; set; }

    public ModeratableType TargetType { get; set; }
    public Guid TargetId { get; set; }
    public Guid UserId { get; set; }

    [Required, MaxLength(16)] public string Emoji { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// OAuth-only account (Discord/GitHub; "dev" in development). No passwords.
// Unique per (Provider, ProviderUserId) — see UserConfiguration.
public class User
{
    [Key] public Guid Id { get; set; }

    [Required, MaxLength(20)] public string Provider { get; set; } = null!;      // discord | github | dev
    [Required, MaxLength(100)] public string ProviderUserId { get; set; } = null!;
    [Required, MaxLength(80)] public string DisplayName { get; set; } = null!;
    // Immutable, unique, URL-safe slug for the public profile. DisplayName is rewritten from OAuth
    // on every login, so it can't be the route key. Assigned once on first sight; nullable for
    // pre-existing rows until their next login.
    [MaxLength(80)] public string? Handle { get; set; }
    [MaxLength(400)] public string? AvatarUrl { get; set; }
    [MaxLength(200)] public string? Email { get; set; }

    public UserRole Role { get; set; } = UserRole.User;
    public bool IsBanned { get; set; }

    // Free-text profile blurb, shown on /user/{handle}. Moderators can soft-hide it (kept for the
    // owner to fix); editing the bio clears the hide so the new text goes live again.
    [MaxLength(500)] public string? Bio { get; set; }
    public bool BioHidden { get; set; }
    [MaxLength(500)] public string? BioHiddenReason { get; set; }

    // Denormalized cumulative score — sum of Solve.PointsAwarded, bumped atomically on each solve.
    public int Points { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime LastLoginAt { get; set; }
}

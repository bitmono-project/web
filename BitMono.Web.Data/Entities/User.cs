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
    [MaxLength(400)] public string? AvatarUrl { get; set; }
    [MaxLength(200)] public string? Email { get; set; }

    public UserRole Role { get; set; } = UserRole.User;
    public bool IsBanned { get; set; }

    // Denormalized cumulative score — sum of Solve.PointsAwarded, bumped atomically on each solve.
    public int Points { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime LastLoginAt { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// One row per (crackme, voter). Difficulty AND quality, 1–6 each (crackmes.one's two axes).
// Drives the denormalized sums/counts on Crackme.
public class Rating
{
    [Key] public Guid Id { get; set; }

    public Guid CrackmeId { get; set; }
    public Crackme Crackme { get; set; } = null!;

    public Guid? VoterUserId { get; set; }
    [MaxLength(64)] public string? VoterIpHash { get; set; } // hashed IP for anon de-dupe

    public byte Difficulty { get; set; } // 1–6
    public byte Quality { get; set; }    // 1–6

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

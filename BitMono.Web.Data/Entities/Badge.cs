using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// The badge catalogue (a small, seeded reference table). Code is a stable string key.
public class Badge
{
    [Key, MaxLength(40)] public string Code { get; set; } = null!;
    [Required, MaxLength(60)] public string Name { get; set; } = null!;
    [Required, MaxLength(200)] public string Description { get; set; } = null!;
    public BadgeRarity Rarity { get; set; }
    public int SortOrder { get; set; }
}

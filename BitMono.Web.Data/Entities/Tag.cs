using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

public class Tag
{
    [Key] public Guid Id { get; set; }
    [Required, MaxLength(40)] public string Slug { get; set; } = null!;
    [Required, MaxLength(60)] public string Name { get; set; } = null!;
    public int UsageCount { get; set; }
    public DateTime CreatedAt { get; set; }

    public ICollection<CrackmeTag> Crackmes { get; set; } = [];
}

// Explicit join (so we can index + carry AddedAt). Composite PK (CrackmeId, TagId).
public class CrackmeTag
{
    public Guid CrackmeId { get; set; }
    public Crackme Crackme { get; set; } = null!;
    public Guid TagId { get; set; }
    public Tag Tag { get; set; } = null!;
    public DateTime AddedAt { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// Legal consent record captured at upload. Append-only — never deleted even if the crackme is.
public class TermsAcceptance
{
    [Key] public Guid Id { get; set; }

    public Guid? UserId { get; set; }
    [Required, MaxLength(20)] public string TermsVersion { get; set; } = null!;
    public DateTime AcceptedAt { get; set; }
    [MaxLength(45)] public string? Ip { get; set; }
    [MaxLength(512)] public string? UserAgent { get; set; }
}

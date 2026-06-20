using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// A writeup / proof of crack. Moderated (writeups spoil + can carry attachments).
public class Solution
{
    [Key] public Guid Id { get; set; }

    public Guid CrackmeId { get; set; }
    public Crackme Crackme { get; set; } = null!;

    public Guid? AuthorUserId { get; set; }
    [MaxLength(50)] public string? AnonymousHandle { get; set; }

    [MaxLength(150)] public string? Title { get; set; }
    [Required, MaxLength(40000)] public string BodyMarkdown { get; set; } = null!;

    public SolutionStatus Status { get; set; } = SolutionStatus.Pending;

    // Optional attachment (patched binary / keygen) in R2.
    public bool HasAttachment { get; set; }
    [MaxLength(512)] public string? StorageKey { get; set; }
    [MaxLength(64)] public string? Sha256 { get; set; }
    public long? SizeBytes { get; set; }

    public int UpvoteCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

public class Comment
{
    [Key] public Guid Id { get; set; }

    public Guid CrackmeId { get; set; }
    public Crackme Crackme { get; set; } = null!;

    public Guid? ParentCommentId { get; set; }
    public Comment? ParentComment { get; set; }

    public Guid? AuthorUserId { get; set; }
    [MaxLength(50)] public string? AnonymousHandle { get; set; }

    [Required, MaxLength(4000)] public string Body { get; set; } = null!;
    public bool IsSpoiler { get; set; }
    public bool IsDeleted { get; set; } // soft-delete keeps thread shape; body blanked
    public bool IsHidden { get; set; }   // moderator hide

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

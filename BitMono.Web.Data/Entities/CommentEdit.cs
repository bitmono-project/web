using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// A prior version of a comment's body, kept so the author (and readers) can see the edit history.
public class CommentEdit
{
    [Key] public Guid Id { get; set; }

    public Guid CommentId { get; set; }
    public Comment Comment { get; set; } = null!;

    [Required, MaxLength(4000)] public string Body { get; set; } = null!;
    public DateTime EditedAt { get; set; }
}

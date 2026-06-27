using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// An in-app notification for one recipient. Bare Guids (like Reaction) — insert-only, polled.
public class Notification
{
    [Key] public Guid Id { get; set; }

    public Guid RecipientUserId { get; set; }
    public NotificationType Type { get; set; }

    [Required, MaxLength(160)] public string Title { get; set; } = null!;
    [MaxLength(2000)] public string? Body { get; set; }
    [MaxLength(400)] public string? LinkUrl { get; set; }

    public bool IsRead { get; set; }
    public Guid? ActorUserId { get; set; } // who caused it (for self-skip + future "X did Y")
    public Guid? CrackmeId { get; set; }
    public DateTime CreatedAt { get; set; }
}

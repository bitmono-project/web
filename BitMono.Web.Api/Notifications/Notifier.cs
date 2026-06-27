using BitMono.Web.Data;
using BitMono.Web.Data.Entities;

namespace BitMono.Web.Api.Notifications;

// Insert-and-save one notification. No-ops when there's no real recipient or it would notify the
// actor about their own action. Callers wrap in try/catch so a notify can never break the primary action.
public static class Notifier
{
    public static async Task NotifyAsync(
        CrackmesDbContext db, Guid? recipientId, NotificationType type,
        string title, string? body, string? link, Guid? actorId, Guid? crackmeId, CancellationToken ct)
    {
        if (recipientId is null || recipientId == actorId)
            return;

        db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            RecipientUserId = recipientId.Value,
            Type = type,
            Title = title.Length > 160 ? title[..160] : title,
            Body = body is { Length: > 2000 } ? body[..2000] : body,
            LinkUrl = link,
            ActorUserId = actorId,
            CrackmeId = crackmeId,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);
    }
}

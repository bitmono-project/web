using BitMono.Web.Data;

namespace BitMono.Web.Api.Models;

public sealed record NotificationItem(
    Guid Id,
    NotificationType Type,
    string Title,
    string? Body,
    string? LinkUrl,
    bool IsRead,
    DateTime CreatedAt);

public sealed record NotificationList(IReadOnlyList<NotificationItem> Items, int UnreadCount);

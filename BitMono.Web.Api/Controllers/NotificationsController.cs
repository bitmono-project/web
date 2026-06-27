using System.Security.Claims;
using BitMono.Web.Api.Models;
using BitMono.Web.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController(IServiceScopeFactory scopeFactory) : ControllerBase
{
    [HttpGet]
    public async Task<NotificationList> List(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var uid = Guid.Parse(User.FindFirstValue("uid")!);

        var items = await db.Notifications.AsNoTracking()
            .Where(n => n.RecipientUserId == uid)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .Select(n => new NotificationItem(n.Id, n.Type, n.Title, n.Body, n.LinkUrl, n.IsRead, n.CreatedAt))
            .ToListAsync(ct);
        var unread = await db.Notifications.AsNoTracking().CountAsync(n => n.RecipientUserId == uid && !n.IsRead, ct);
        return new NotificationList(items, unread);
    }

    [HttpGet("unread-count")]
    public async Task<int> UnreadCount(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var uid = Guid.Parse(User.FindFirstValue("uid")!);
        return await db.Notifications.AsNoTracking().CountAsync(n => n.RecipientUserId == uid && !n.IsRead, ct);
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> ReadAll(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var uid = Guid.Parse(User.FindFirstValue("uid")!);
        await db.Notifications.Where(n => n.RecipientUserId == uid && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> Read(Guid id, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var uid = Guid.Parse(User.FindFirstValue("uid")!);
        await db.Notifications.Where(n => n.Id == id && n.RecipientUserId == uid)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), ct);
        return NoContent();
    }
}

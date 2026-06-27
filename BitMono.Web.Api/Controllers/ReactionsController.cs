using System.Security.Claims;
using BitMono.Web.Api.Helpers;
using BitMono.Web.Api.Models;
using BitMono.Web.Data;
using BitMono.Web.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Controllers;

[ApiController]
[Route("api/reactions")]
[Authorize]
public sealed class ReactionsController(IServiceScopeFactory scopeFactory) : ControllerBase
{
    [HttpPost("crackme/{slug}/toggle")]
    public async Task<ActionResult<ReactionSummary>> ToggleCrackme(string slug, [FromBody] ReactionToggleRequest req, CancellationToken ct)
    {
        if (!ReactionEmojis.IsValid(req.Emoji))
            return BadRequest("Unknown reaction.");

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var c = await db.Crackmes.AsNoTracking()
            .Where(x => x.Slug == slug && x.Status == CrackmeStatus.Approved && !x.IsTakenDown)
            .Select(x => new CrackmeReactionTarget(x.Id, x.ReactionsEnabled))
            .FirstOrDefaultAsync(ct);
        if (c is null)
            return NotFound();
        if (!c.ReactionsEnabled)
            return BadRequest("Reactions are turned off for this crackme.");

        return await ToggleAsync(db, ModeratableType.Crackme, c.Id, req.Emoji, singlePerUser: false, ct);
    }

    [HttpPost("comment/{commentId:guid}/toggle")]
    public async Task<ActionResult<ReactionSummary>> ToggleComment(Guid commentId, [FromBody] ReactionToggleRequest req, CancellationToken ct)
    {
        if (!ReactionEmojis.IsValid(req.Emoji))
            return BadRequest("Unknown reaction.");

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var commentReactionsEnabled = await db.Comments.AsNoTracking()
            .Where(x => x.Id == commentId && !x.IsDeleted && !x.IsHidden
                && x.Crackme.Status == CrackmeStatus.Approved && !x.Crackme.IsTakenDown)
            .Select(x => (bool?)x.Crackme.CommentReactionsEnabled)
            .FirstOrDefaultAsync(ct);
        if (commentReactionsEnabled is null)
            return NotFound();
        if (!commentReactionsEnabled.Value)
            return BadRequest("Comment reactions are turned off for this crackme.");

        // One reaction per user per comment — a different emoji replaces the previous one.
        return await ToggleAsync(db, ModeratableType.Comment, commentId, req.Emoji, singlePerUser: true, ct);
    }

    private async Task<ReactionSummary> ToggleAsync(
        CrackmesDbContext db, ModeratableType type, Guid targetId, string emoji, bool singlePerUser, CancellationToken ct)
    {
        var uid = Guid.Parse(User.FindFirstValue("uid")!);
        var existing = await db.Reactions
            .FirstOrDefaultAsync(r => r.TargetType == type && r.TargetId == targetId && r.UserId == uid && r.Emoji == emoji, ct);

        if (existing is not null)
        {
            db.Reactions.Remove(existing); // same emoji again → toggle off
        }
        else
        {
            if (singlePerUser)
            {
                var others = await db.Reactions
                    .Where(r => r.TargetType == type && r.TargetId == targetId && r.UserId == uid).ToListAsync(ct);
                db.Reactions.RemoveRange(others);
            }
            db.Reactions.Add(new Reaction
            {
                Id = Guid.NewGuid(),
                TargetType = type,
                TargetId = targetId,
                UserId = uid,
                Emoji = emoji,
                CreatedAt = DateTime.UtcNow,
            });
        }
        await db.SaveChangesAsync(ct);

        var all = await db.Reactions.AsNoTracking()
            .Where(r => r.TargetType == type && r.TargetId == targetId)
            .Select(r => new ReactionRow(r.Emoji, r.UserId)).ToListAsync(ct);
        var counts = all.GroupBy(r => r.Emoji).ToDictionary(g => g.Key, g => g.Count());
        var mine = all.Where(r => r.UserId == uid).Select(r => r.Emoji).ToList();
        return new ReactionSummary(counts, mine);
    }
}

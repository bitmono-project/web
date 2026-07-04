using BitMono.Web.Api.Helpers;
using BitMono.Web.Api.Models;
using BitMono.Web.Api.Progression;
using BitMono.Web.Data;
using BitMono.Web.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Controllers;

[ApiController]
[Route("api/users")]
public sealed class UsersController(IServiceScopeFactory scopeFactory) : ControllerBase
{
    [HttpGet("{handle}")]
    public async Task<IActionResult> Profile(string handle, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var u = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Handle != null && x.Handle.ToLower() == handle.ToLower(), ct);
        if (u is null || u.IsBanned)
            return NotFound();

        // Counts reuse the gallery's public predicate so the numbers agree site-wide.
        var authored = await db.Crackmes.AsNoTracking()
            .CountAsync(c => c.UploaderUserId == u.Id && c.Status == CrackmeStatus.Approved && !c.IsTakenDown, ct);
        var writeups = await db.Solutions.AsNoTracking()
            .CountAsync(s => s.AuthorUserId == u.Id && s.Status == SolutionStatus.Approved, ct);
        var solves = await db.Solves.AsNoTracking().CountAsync(s => s.UserId == u.Id, ct);
        var position = u.Points > 0
            ? await db.Users.AsNoTracking().CountAsync(x => x.Points > u.Points, ct) + 1
            : (int?)null;
        var badges = await db.UserBadges.AsNoTracking()
            .Where(ub => ub.UserId == u.Id)
            .Join(db.Badges.AsNoTracking(), ub => ub.BadgeCode, b => b.Code,
                (ub, b) => new { b.Code, b.Name, b.Description, b.Rarity, b.SortOrder, ub.AwardedAt })
            .OrderBy(x => x.SortOrder)
            .Select(x => new ProfileBadge(x.Code, x.Name, x.Description, x.Rarity, x.AwardedAt))
            .ToListAsync(ct);

        // A hidden bio disappears for the public; the owner and staff still see it (with the reason)
        // so it can be fixed or unhidden.
        var viewerId = User.UserIdOrNull();
        var canSeeHidden = viewerId == u.Id
            || User.IsInRole(nameof(UserRole.Moderator)) || User.IsInRole(nameof(UserRole.Admin));
        var bio = u.BioHidden && !canSeeHidden ? null : u.Bio;
        var bioHidden = u.BioHidden && canSeeHidden;

        return Ok(new UserProfile(
            u.Id, u.Handle!, u.DisplayName, u.AvatarUrl, u.Role.ToString(), u.CreatedAt,
            u.Points, Ranks.For(u.Points).Name, position, solves, authored, writeups, badges,
            bio, bioHidden, bioHidden ? u.BioHiddenReason : null));
    }

    [HttpGet("{handle}/crackmes")]
    public async Task<IReadOnlyList<ProfileCrackme>> Crackmes(string handle, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var uid = await db.Users.AsNoTracking()
            .Where(x => x.Handle != null && x.Handle.ToLower() == handle.ToLower())
            .Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        if (uid is null)
            return [];

        return await db.Crackmes.AsNoTracking()
            .Where(c => c.UploaderUserId == uid && c.Status == CrackmeStatus.Approved && !c.IsTakenDown)
            .OrderByDescending(c => c.PublishedAt ?? c.CreatedAt)
            .Select(c => new ProfileCrackme(c.Slug, c.Title, c.AuthorDifficulty, c.DownloadCount, c.SolvedCount, c.PublishedAt ?? c.CreatedAt))
            .ToListAsync(ct);
    }

    // Set (or clear) your own bio. Editing clears a moderator hide — the fixed text goes live and
    // moderators can re-hide if it's still off.
    [HttpPut("me/bio")]
    [Authorize]
    [EnableRateLimiting("comment")]
    public async Task<IActionResult> SetMyBio([FromBody] BioRequest req, CancellationToken ct)
    {
        var bio = req.Bio?.Trim();
        if (bio is { Length: > 500 })
            bio = bio[..500];

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var u = await db.Users.FirstOrDefaultAsync(x => x.Id == User.UserId(), ct);
        if (u is null)
            return NotFound();

        u.Bio = string.IsNullOrEmpty(bio) ? null : bio;
        u.BioHidden = false;
        u.BioHiddenReason = null;
        await db.SaveChangesAsync(ct);
        return Ok(new { bio = u.Bio });
    }

    // "Report this profile" — same shape as crackme reports; feeds the same moderation queue.
    [HttpPost("{handle}/report")]
    [EnableRateLimiting("comment")]
    public async Task<IActionResult> Report(string handle, [FromBody] ReportRequest req, CancellationToken ct)
    {
        if (!Enum.TryParse<ReportReason>(req.Reason, ignoreCase: true, out var reason))
            return BadRequest("Unknown report reason.");

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var target = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Handle != null && x.Handle.ToLower() == handle.ToLower() && !x.IsBanned, ct);
        if (target is null)
            return NotFound();

        var uid = User.UserIdOrNull();
        if (uid == target.Id)
            return BadRequest("You can't report your own profile.");

        // One open report per reporter per profile — silently no-op on repeats (mirrors crackme reports).
        var ip = HttpContext.GetClientIp();
        var already = uid is not null
            ? await db.Reports.AsNoTracking().AnyAsync(r =>
                r.TargetType == ModeratableType.UserProfile && r.TargetId == target.Id && !r.IsResolved && r.ReporterUserId == uid, ct)
            : ip is not null && await db.Reports.AsNoTracking().AnyAsync(r =>
                r.TargetType == ModeratableType.UserProfile && r.TargetId == target.Id && !r.IsResolved && r.ReporterUserId == null && r.ReporterIp == ip, ct);
        if (already)
            return Accepted();

        db.Reports.Add(new Report
        {
            Id = Guid.NewGuid(),
            TargetType = ModeratableType.UserProfile,
            TargetId = target.Id,
            ReporterUserId = uid,
            ReporterIp = ip,
            Reason = reason,
            Details = req.Details is { Length: > 2000 } d ? d[..2000] : req.Details,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);
        return Accepted();
    }
}

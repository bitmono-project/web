using BitMono.Web.Api.Models;
using BitMono.Web.Api.Progression;
using BitMono.Web.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Controllers;

[ApiController]
[Route("api/users")]
public sealed class UsersController(IServiceScopeFactory scopeFactory) : ControllerBase
{
    [HttpGet("{handle}")]
    public async Task<ActionResult<UserProfile>> Profile(string handle, CancellationToken ct)
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

        return new UserProfile(
            u.Handle!, u.DisplayName, u.AvatarUrl, u.Role.ToString(), u.CreatedAt,
            u.Points, Ranks.For(u.Points).Name, position, solves, authored, writeups, badges);
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
}

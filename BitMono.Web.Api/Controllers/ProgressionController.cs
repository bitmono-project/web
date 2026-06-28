using System.Security.Claims;
using BitMono.Web.Api.Models;
using BitMono.Web.Api.Progression;
using BitMono.Web.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Controllers;

[ApiController]
[Route("api/progression")]
public sealed class ProgressionController(IServiceScopeFactory scopeFactory) : ControllerBase
{
    private const int PageSize = 50;
    private const string UnknownUser = "unknown"; // defensive fallback if a ranked user row is missing

    // scope: overall (default, uses the User.Points cache) | monthly (last 30 days) | dotnet (.NET-family crackmes)
    [HttpGet("leaderboard")]
    public async Task<LeaderboardResponse> Leaderboard([FromQuery] string? scope, [FromQuery] int page = 1, CancellationToken ct = default)
    {
        await using var s = scopeFactory.CreateAsyncScope();
        var db = s.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        page = Math.Max(1, page);

        List<(Guid UserId, int Points, int Solves)> ranked;
        int total;

        if (scope is "monthly" or "dotnet")
        {
            var src = db.Solves.AsNoTracking();
            var filtered = scope == "monthly"
                ? src.Where(x => x.SolvedAt >= DateTime.UtcNow.AddDays(-30))
                : src.Where(x => db.Crackmes.Any(c => c.Id == x.CrackmeId &&
                    (c.TargetPlatform == TargetPlatform.DotNet || c.TargetPlatform == TargetPlatform.Mono || c.TargetPlatform == TargetPlatform.NetFramework)));

            var agg = await filtered
                .GroupBy(x => x.UserId)
                .Select(g => new { UserId = g.Key, Points = g.Sum(x => x.PointsAwarded), Solves = g.Count() })
                .OrderByDescending(x => x.Points).ThenBy(x => x.UserId)
                .ToListAsync(ct);
            total = agg.Count;
            ranked = agg.Skip((page - 1) * PageSize).Take(PageSize).Select(x => (x.UserId, x.Points, x.Solves)).ToList();
        }
        else
        {
            total = await db.Users.AsNoTracking().CountAsync(u => u.Points > 0, ct);
            var users = await db.Users.AsNoTracking().Where(u => u.Points > 0)
                .OrderByDescending(u => u.Points).ThenBy(u => u.Id)
                .Skip((page - 1) * PageSize).Take(PageSize)
                .Select(u => new { u.Id, u.Points }).ToListAsync(ct);
            var uids = users.Select(u => u.Id).ToList();
            var counts = (await db.Solves.AsNoTracking().Where(x => uids.Contains(x.UserId))
                    .GroupBy(x => x.UserId).Select(g => new { g.Key, C = g.Count() }).ToListAsync(ct))
                .ToDictionary(x => x.Key, x => x.C);
            ranked = users.Select(u => (u.Id, u.Points, counts.GetValueOrDefault(u.Id))).ToList();
        }

        var idList = ranked.Select(r => r.UserId).ToList();
        var info = (await db.Users.AsNoTracking().Where(u => idList.Contains(u.Id))
                .Select(u => new { u.Id, u.DisplayName, u.AvatarUrl, u.Handle }).ToListAsync(ct))
            .ToDictionary(u => u.Id, u => (u.DisplayName, u.AvatarUrl, u.Handle));

        var items = ranked.Select((r, i) =>
        {
            info.TryGetValue(r.UserId, out var u);
            return new LeaderboardEntry(
                (page - 1) * PageSize + i + 1, r.UserId, u.Handle, u.DisplayName ?? UnknownUser, u.AvatarUrl,
                r.Points, r.Solves, Ranks.For(r.Points).Name);
        }).ToList();

        return new LeaderboardResponse(items, total, page, PageSize);
    }

    [HttpGet("my-rank")]
    [Authorize]
    public async Task<IActionResult> MyRank(CancellationToken ct)
    {
        await using var s = scopeFactory.CreateAsyncScope();
        var db = s.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var uid = Guid.Parse(User.FindFirstValue("uid")!);

        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == uid, ct);
        if (u is null)
            return NotFound();

        var solves = await db.Solves.AsNoTracking().CountAsync(x => x.UserId == uid, ct);
        var position = u.Points > 0
            ? await db.Users.AsNoTracking().CountAsync(x => x.Points > u.Points, ct) + 1
            : (int?)null;
        var next = Ranks.Next(u.Points);

        return Ok(new MyRankResponse(
            u.Points, solves, Ranks.For(u.Points).Name,
            next?.Name, next is null ? null : next.MinPoints - u.Points, position));
    }
}

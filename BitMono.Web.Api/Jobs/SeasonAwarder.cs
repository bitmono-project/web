using BitMono.Web.Api.Badges;
using BitMono.Web.Api.Progression;
using BitMono.Web.Data;
using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Jobs;

// Runs daily: for every season that has ended but hasn't been settled yet, mint its podium badge and
// award it to the top 3 season scorers. Idempotent — the badge's existence marks a season as settled,
// so a re-run (or a missed day) backfills without double-awarding.
public sealed class SeasonAwarder(IServiceScopeFactory scopeFactory, ILogger<SeasonAwarder> logger)
{
    public async Task RunAsync(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var current = Seasons.Current;
        // Walk every ended season (1 .. current-1). The loop is tiny (one per 13 weeks) and self-limits.
        for (var n = 1; n < current; n++)
        {
            var code = BadgeService.SeasonPodium(n);
            if (await db.Badges.AsNoTracking().AnyAsync(b => b.Code == code, ct))
                continue; // already settled

            var (start, end) = (Seasons.StartOf(n), Seasons.EndOf(n));
            var top = await db.Solves.AsNoTracking()
                .Where(x => x.SolvedAt >= start && x.SolvedAt < end)
                .GroupBy(x => x.UserId)
                .Select(g => new { UserId = g.Key, Points = g.Sum(x => x.PointsAwarded) })
                .OrderByDescending(x => x.Points).ThenBy(x => x.UserId)
                .Take(3)
                .Select(x => x.UserId)
                .ToListAsync(ct);
            if (top.Count == 0)
                continue; // a dead season earns no badge — skip so it settles the first time anyone plays

            db.Badges.Add(new Badge
            {
                Code = code,
                Name = $"Season {n}: {Seasons.NameOf(n)}",
                Description = $"Finished top 3 in Season {n} ({Seasons.NameOf(n)}).",
                Rarity = BadgeRarity.Legendary,
                SortOrder = 100 + n,
            });
            await db.SaveChangesAsync(ct);

            foreach (var uid in top)
                await BadgeService.TryAwardAsync(db, uid, code, ct);

            logger.LogInformation("Season {N} settled — awarded {Code} to {Count} finishers", n, code, top.Count);
        }
    }
}

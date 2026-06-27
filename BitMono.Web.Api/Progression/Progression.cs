using BitMono.Web.Api.Notifications;
using BitMono.Web.Data;
using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Progression;

// Difficulty-weighted points that decay as a challenge gets over-solved, plus a first-blood bonus.
// Locked into Solve.PointsAwarded at solve time so the leaderboard just SUMs a column.
public static class Scoring
{
    private static readonly int[] Base = [50, 100, 200, 350, 550, 800]; // VeryEasy..Insane

    // Community average once rated, else the author's claim. Clamped 1..6.
    public static int EffectiveDifficulty(Crackme c) =>
        c.DifficultyCount > 0
            ? Math.Clamp((int)Math.Round((double)c.DifficultySum / c.DifficultyCount), 1, 6)
            : Math.Clamp((int)c.AuthorDifficulty, 1, 6);

    // 1.0 for the first solver, asymptotically → 0.30 as more people solve it.
    public static double Decay(int priorSolvers) => 0.30 + 0.70 / (1 + priorSolvers / 8.0);

    public static int PointsFor(int effectiveDifficulty, int priorSolvers, bool firstBlood)
    {
        var b = Base[Math.Clamp(effectiveDifficulty, 1, 6) - 1];
        var pts = (int)Math.Round(b * Decay(priorSolvers));
        if (firstBlood) pts += (int)Math.Round(b * 0.5);
        return pts;
    }
}

public sealed record RankInfo(string Name, int MinPoints);

public static class Ranks
{
    // Points-only ladder, RE-flavored, easy → legendary.
    public static readonly RankInfo[] Ladder =
    [
        new("script kiddie", 0),
        new("unpacker", 250),
        new("patcher", 750),
        new("disassembler", 2_000),
        new("deobfuscator", 5_000),
        new("devirtualizer", 12_000),
        new("ghost in the IL", 25_000),
        new("nop-sled legend", 50_000),
    ];

    public static RankInfo For(int points)
    {
        var rank = Ladder[0];
        foreach (var r in Ladder)
            if (points >= r.MinPoints)
                rank = r;
        return rank;
    }

    public static RankInfo? Next(int points)
    {
        foreach (var r in Ladder)
            if (points < r.MinPoints)
                return r;
        return null;
    }
}

public static class SolveRecorder
{
    // Records a solve for (user, crackme) unless they already solved it or they're the uploader.
    // Bumps SolvedCount + User.Points atomically (like the download counter). Returns the new Solve
    // or null if it was a no-op.
    public static async Task<Solve?> TryRecordAsync(CrackmesDbContext db, Crackme c, Guid userId, SolveSource source, CancellationToken ct)
    {
        if (c.UploaderUserId == userId)
            return null;
        if (await db.Solves.AsNoTracking().AnyAsync(s => s.UserId == userId && s.CrackmeId == c.Id, ct))
            return null;

        // Insert first — the unique (UserId, CrackmeId) index is the authoritative dedup guard.
        var solve = new Solve
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CrackmeId = c.Id,
            Source = source,
            SolvedAt = DateTime.UtcNow,
        };
        db.Solves.Add(solve);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return null; // lost the race on the unique index — already solved
        }

        // Claim first blood atomically: only the solver who flips SolvedCount 0 -> 1 wins it, so
        // concurrent solves can't both be "first blood" (the stale-snapshot race).
        var wonFirstBlood = await db.Crackmes.Where(x => x.Id == c.Id && x.SolvedCount == 0)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.SolvedCount, 1), ct);
        var firstBlood = wonFirstBlood == 1;
        if (!firstBlood)
            await db.Crackmes.Where(x => x.Id == c.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.SolvedCount, x => x.SolvedCount + 1), ct);

        // Decay is keyed on the prior solver count = the fresh post-bump count minus this solve.
        var newCount = await db.Crackmes.AsNoTracking().Where(x => x.Id == c.Id).Select(x => x.SolvedCount).FirstAsync(ct);
        var points = Scoring.PointsFor(Scoring.EffectiveDifficulty(c), Math.Max(0, newCount - 1), firstBlood);

        solve.PointsAwarded = points;
        solve.IsFirstBlood = firstBlood;
        await db.SaveChangesAsync(ct);
        await db.Users.Where(u => u.Id == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.Points, u => u.Points + points), ct);

        try
        {
            await Notifier.NotifyAsync(db, c.UploaderUserId,
                firstBlood ? NotificationType.FirstBlood : NotificationType.SolvedYourCrackme,
                firstBlood ? $"First blood on '{c.Title}'!" : $"Someone solved '{c.Title}'",
                null, $"/challenge/{c.Slug}", userId, c.Id, ct);
        }
        catch { }
        return solve;
    }

    public static async Task<bool> RemoveAsync(CrackmesDbContext db, Guid crackmeId, Guid userId, CancellationToken ct)
    {
        var solve = await db.Solves.FirstOrDefaultAsync(s => s.UserId == userId && s.CrackmeId == crackmeId, ct);
        if (solve is null)
            return false;

        var points = solve.PointsAwarded;
        db.Solves.Remove(solve);
        await db.SaveChangesAsync(ct);

        await db.Crackmes.Where(x => x.Id == crackmeId && x.SolvedCount > 0)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.SolvedCount, x => x.SolvedCount - 1), ct);
        await db.Users.Where(u => u.Id == userId && u.Points >= points)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.Points, u => u.Points - points), ct);
        return true;
    }
}

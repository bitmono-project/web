using BitMono.Web.Api.Progression;
using BitMono.Web.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Controllers;

// WeChall (wechall.net) site-connector — the two GET scripts their aggregator polls to link accounts
// and pull scores, so a bitmono player's progress counts toward their cross-site WeChall rank.
// Protocol: https://www.wechall.net/en/join_us — plaintext responses, values url-encoded.
// The shared WeChall:AuthKey gates account-existence probing; register the two URLs + key with WeChall.
[ApiController]
[Route("api/wechall")]
public sealed class WeChallController(IServiceScopeFactory scopeFactory, IConfiguration cfg) : ControllerBase
{
    // validate: does this (username, email) own an account here? Returns "1" or "0" (WeChall spec).
    // AuthKey is REQUIRED here — without it this would let anyone probe whether an email is registered.
    [HttpGet("validate")]
    public async Task<IActionResult> Validate([FromQuery] string? username, [FromQuery] string? email, [FromQuery] string? authkey, CancellationToken ct)
    {
        var key = cfg["WeChall:AuthKey"];
        if (string.IsNullOrEmpty(key) || authkey != key)
            return Plain("0");
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(email))
            return Plain("0");

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        // Handle is our public username (unique, lowercase slug); email is what OAuth gave us. The AuthKey
        // is the real guard, so a forgiving case-insensitive match maximizes successful links.
        var exists = await db.Users.AsNoTracking().AnyAsync(u =>
            !u.IsBanned && u.Handle != null && u.Handle.ToLower() == username.ToLower()
            && u.Email != null && u.Email.ToLower() == email.ToLower(), ct);
        return Plain(exists ? "1" : "0");
    }

    // userscore: a user's standing here, as "username:rank:score:maxscore:solved:challcount:usercount"
    // (WeChall's preferred format). Scores are already public (leaderboard/profiles), so AuthKey is
    // optional — enforced only if one is configured.
    [HttpGet("score")]
    public async Task<IActionResult> Score([FromQuery] string? username, [FromQuery] string? authkey, CancellationToken ct)
    {
        var key = cfg["WeChall:AuthKey"];
        if (!string.IsNullOrEmpty(key) && authkey != key)
            return Plain("0");
        if (string.IsNullOrWhiteSpace(username))
            return Plain("0");

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var u = await db.Users.AsNoTracking()
            .Where(x => !x.IsBanned && x.Handle != null && x.Handle.ToLower() == username.ToLower())
            .Select(x => new { x.Id, x.Handle, x.Points })
            .FirstOrDefaultAsync(ct);
        if (u is null)
            return Plain("0");

        var rank = await db.Users.AsNoTracking().CountAsync(x => !x.IsBanned && x.Points > u.Points, ct) + 1;
        var usercount = await db.Users.AsNoTracking().CountAsync(x => !x.IsBanned, ct);
        var solved = await db.Solves.AsNoTracking().CountAsync(s => s.UserId == u.Id, ct);

        // challcount + maxscore span every public crackme. maxscore = "solve everything at first-blood",
        // the theoretical ceiling so score never exceeds it. ponytail: recomputed per call — the crackme
        // table is small and WeChall polls rarely; cache in IMemoryCache if that ever changes.
        var diffs = await db.Crackmes.AsNoTracking()
            .Where(c => c.Status == CrackmeStatus.Approved && !c.IsTakenDown)
            .Select(c => new { c.DifficultySum, c.DifficultyCount, c.AuthorDifficulty })
            .ToListAsync(ct);
        var challcount = diffs.Count;
        var maxscore = diffs.Sum(d => Scoring.MaxPointsFor(Scoring.EffectiveDifficulty(d.DifficultySum, d.DifficultyCount, d.AuthorDifficulty)));

        return Plain($"{u.Handle}:{rank}:{u.Points}:{maxscore}:{solved}:{challcount}:{usercount}");
    }

    private ContentResult Plain(string body) => Content(body, "text/plain");
}

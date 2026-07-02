using BitMono.Web.Data;
using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Json;

namespace BitMono.Web.Api.Notifications;

// Posts an embed to a Discord channel webhook (Discord:WebhookUrl) when a challenge goes live or
// gets solved. Runs as a Hangfire job — callers just enqueue, retries on 429/downtime come free.
// No-ops when the webhook URL isn't configured.
public sealed class DiscordWebhook(CrackmesDbContext db, IHttpClientFactory httpFactory, IConfiguration cfg)
{
    private const string SiteUrl = "https://bitmono.dev";
    private const int Acid = 0xC6FF3D;    // design-system accent
    private const int Blood = 0xE5484D;

    public async Task ChallengePublishedAsync(Guid crackmeId, CancellationToken ct)
    {
        var c = await db.Crackmes.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == crackmeId && x.Status == CrackmeStatus.Approved && !x.IsTakenDown, ct);
        if (c is null)
            return;

        await SendAsync(new
        {
            title = $"New challenge: {c.Title}",
            url = $"{SiteUrl}/challenge/{c.Slug}",
            description = c.Description is { Length: > 300 } ? c.Description[..300] + "…" : c.Description,
            color = Acid,
            fields = new object[]
            {
                new { name = "Difficulty", value = Humanize(c.AuthorDifficulty), inline = true },
                new { name = "Platform", value = c.TargetPlatform.ToString(), inline = true },
                new { name = "Author", value = await AuthorAsync(c, ct), inline = true },
            },
            timestamp = (c.PublishedAt ?? DateTime.UtcNow).ToString("O"),
        }, ct);
    }

    public async Task SolvedAsync(Guid solveId, CancellationToken ct)
    {
        var s = await db.Solves.AsNoTracking().FirstOrDefaultAsync(x => x.Id == solveId, ct);
        if (s is null)
            return;
        var c = await db.Crackmes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == s.CrackmeId, ct);
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == s.UserId, ct);
        if (c is null || u is null)
            return;

        await SendAsync(new
        {
            title = s.IsFirstBlood ? $"🩸 First blood on '{c.Title}'" : $"'{c.Title}' was solved",
            url = $"{SiteUrl}/challenge/{c.Slug}",
            description = $"{Link(u.DisplayName, u.Handle)} earned **{s.PointsAwarded}** points",
            color = s.IsFirstBlood ? Blood : Acid,
            timestamp = s.SolvedAt.ToString("O"),
        }, ct);
    }

    private async Task<string> AuthorAsync(Crackme c, CancellationToken ct)
    {
        if (c.UploaderUserId is { } uid)
        {
            var u = await db.Users.AsNoTracking().Where(x => x.Id == uid)
                .Select(x => new { x.DisplayName, x.Handle }).FirstOrDefaultAsync(ct);
            if (u is not null)
                return Link(u.DisplayName, u.Handle);
        }
        return c.AnonymousHandle ?? AppConstants.AnonymousHandle;
    }

    private static string Link(string displayName, string? handle) =>
        handle is null ? displayName : $"[{displayName}]({SiteUrl}/user/{handle})";

    private static string Humanize(Difficulty d) => d switch
    {
        Difficulty.VeryEasy => "Very Easy",
        Difficulty.VeryHard => "Very Hard",
        _ => d.ToString(),
    };

    private async Task SendAsync(object embed, CancellationToken ct)
    {
        var url = cfg["Discord:WebhookUrl"];
        if (string.IsNullOrWhiteSpace(url))
            return;
        using var client = httpFactory.CreateClient("discord");
        var payload = new
        {
            username = "BitMono",
            avatar_url = $"{SiteUrl}/mark.png",
            embeds = new[] { embed },
        };
        var response = await client.PostAsJsonAsync(url, payload, ct);
        response.EnsureSuccessStatusCode();   // throw → Hangfire retries with backoff
    }
}

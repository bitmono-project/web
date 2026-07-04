using BitMono.Web.Api.Models;
using BitMono.Web.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Xml.Linq;

namespace BitMono.Web.Api.Controllers;

// RSS 2.0 feed of newly published challenges — for feed readers and Discord/RSS bridge bots.
[ApiController]
[Route("api/feed")]
public sealed class FeedController(CrackmesDbContext db) : ControllerBase
{
    private const string SiteUrl = "https://bitmono.dev";

    // Live activity for the home page: recent solves (first bloods flagged) + freshly published
    // crackmes, merged newest-first. The "is anyone here?" signal a static gallery lacks.
    [HttpGet("activity")]
    [ResponseCache(Duration = 20)]
    public async Task<IReadOnlyList<ActivityItem>> Activity(CancellationToken ct)
    {
        const int take = 15;

        // Recent solves joined to their crackme + solver (public crackmes only).
        var solves = await db.Solves.AsNoTracking()
            .OrderByDescending(s => s.SolvedAt)
            .Take(take)
            .Join(db.Crackmes.Where(c => c.Status == CrackmeStatus.Approved && !c.IsTakenDown),
                s => s.CrackmeId, c => c.Id, (s, c) => new { s, c })
            .Select(x => new
            {
                x.s.IsFirstBlood, x.s.PointsAwarded, x.s.SolvedAt,
                x.c.Title, x.c.Slug,
                Handle = db.Users.Where(u => u.Id == x.s.UserId).Select(u => u.Handle).FirstOrDefault(),
                Name = db.Users.Where(u => u.Id == x.s.UserId).Select(u => u.DisplayName).FirstOrDefault(),
            })
            .ToListAsync(ct);

        var published = await db.Crackmes.AsNoTracking()
            .Where(c => c.Status == CrackmeStatus.Approved && !c.IsTakenDown && c.PublishedAt != null)
            .OrderByDescending(c => c.PublishedAt)
            .Take(take)
            .Select(c => new
            {
                c.Title, c.Slug, c.PublishedAt,
                Handle = c.UploaderUserId == null ? null : db.Users.Where(u => u.Id == c.UploaderUserId).Select(u => u.Handle).FirstOrDefault(),
                Name = c.AnonymousHandle,
            })
            .ToListAsync(ct);

        var items = solves.Select(x => new ActivityItem(
                x.IsFirstBlood ? "firstBlood" : "solve", x.Name, x.Handle, x.Title, x.Slug, x.PointsAwarded, x.SolvedAt))
            .Concat(published.Select(x => new ActivityItem(
                "published", x.Name, x.Handle, x.Title, x.Slug, null, x.PublishedAt!.Value)))
            .OrderByDescending(a => a.At)
            .Take(take)
            .ToList();
        return items;
    }

    [HttpGet("challenges.rss")]
    [ResponseCache(Duration = 300)]
    public async Task<IActionResult> Challenges(CancellationToken ct)
    {
        var rows = await db.Crackmes.AsNoTracking()
            .Where(c => c.Status == CrackmeStatus.Approved && !c.IsTakenDown && c.PublishedAt != null)
            .OrderByDescending(c => c.PublishedAt)
            .Take(50)
            .Select(c => new { c.Slug, c.Title, c.Description, c.AuthorDifficulty, c.TargetPlatform, c.PublishedAt })
            .ToListAsync(ct);

        var rss = new XElement("rss", new XAttribute("version", "2.0"),
            new XElement("channel",
                new XElement("title", "BitMono — new challenges"),
                new XElement("link", $"{SiteUrl}/crackmes"),
                new XElement("description", "Newly published reverse-engineering challenges on bitmono.dev"),
                new XElement("language", "en"),
                rows.Select(c => new XElement("item",
                    new XElement("title", c.Title),
                    new XElement("link", $"{SiteUrl}/challenge/{c.Slug}"),
                    new XElement("guid", $"{SiteUrl}/challenge/{c.Slug}"),
                    new XElement("pubDate", c.PublishedAt!.Value.ToString("R")),
                    new XElement("category", c.AuthorDifficulty.ToString()),
                    new XElement("category", c.TargetPlatform.ToString()),
                    new XElement("description", c.Description ?? "")))));

        return Content("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n" + rss, "application/rss+xml; charset=utf-8");
    }
}

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

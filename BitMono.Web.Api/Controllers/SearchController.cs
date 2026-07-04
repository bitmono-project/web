using BitMono.Web.Api.Models;
using BitMono.Web.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Controllers;

// Site-wide quick search (the header ⌘K palette): crackmes by title, users by handle/name,
// writeups by title. Top few per group — it's a jump-to, not a results page.
[ApiController]
[Route("api/search")]
public sealed class SearchController(IServiceScopeFactory scopeFactory) : ControllerBase
{
    private const int PerGroup = 5;

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] string? q, CancellationToken ct)
    {
        var term = q?.Trim();
        if (term is null || term.Length < 2)
            return Ok(new SearchResponse([], [], []));

        // Escape LIKE wildcards so "100%" searches the literal text.
        var pattern = $"%{term.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_")}%";

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var crackmes = await db.Crackmes.AsNoTracking()
            .Where(c => c.Status == CrackmeStatus.Approved && !c.IsTakenDown && EF.Functions.ILike(c.Title, pattern, @"\"))
            .OrderByDescending(c => c.PublishedAt ?? c.CreatedAt)
            .Take(PerGroup)
            .Select(c => new SearchCrackme(c.Slug, c.Title, c.AnonymousHandle ?? AppConstants.AnonymousHandle, c.AuthorDifficulty))
            .ToListAsync(ct);

        var users = await db.Users.AsNoTracking()
            .Where(u => !u.IsBanned && u.Handle != null
                && (EF.Functions.ILike(u.Handle!, pattern, @"\") || EF.Functions.ILike(u.DisplayName, pattern, @"\")))
            .OrderByDescending(u => u.Points)
            .Take(PerGroup)
            .Select(u => new SearchUser(u.Handle!, u.DisplayName, u.AvatarUrl, u.Points))
            .ToListAsync(ct);

        var writeups = await db.Solutions.AsNoTracking()
            .Where(s => s.Status == SolutionStatus.Approved && s.Title != null && EF.Functions.ILike(s.Title!, pattern, @"\")
                && s.Crackme.Status == CrackmeStatus.Approved && !s.Crackme.IsTakenDown)
            .OrderByDescending(s => s.UpvoteCount)
            .Take(PerGroup)
            .Select(s => new SearchWriteup(s.Id, s.Title!, s.Crackme.Slug, s.Crackme.Title, s.AnonymousHandle ?? AppConstants.AnonymousHandle))
            .ToListAsync(ct);

        return Ok(new SearchResponse(crackmes, users, writeups));
    }
}

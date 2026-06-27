using System.Linq.Expressions;
using BitMono.Web.Api.Models;
using BitMono.Web.Api.Storage;
using BitMono.Web.Data;
using BitMono.Web.Data.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Controllers;

[ApiController]
[Route("api/crackmes")]
public sealed class CrackmesController(IServiceScopeFactory scopeFactory, BlobStorage storage, IConfiguration cfg) : ControllerBase
{
    [HttpGet]
    public async Task<CrackmeListResponse> List([FromQuery] CrackmeQuery q, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var query = db.Crackmes.AsNoTracking().Where(Public);

        if (!string.IsNullOrWhiteSpace(q.Q))
            query = query.Where(c => EF.Functions.ILike(c.Title, $"%{q.Q}%"));
        if (q.Platform is { } platform)
            query = query.Where(c => c.TargetPlatform == platform);
        if (q.MinDifficulty is { } min)
            query = query.Where(c => (int)c.AuthorDifficulty >= min);
        if (q.MaxDifficulty is { } max)
            query = query.Where(c => (int)c.AuthorDifficulty <= max);
        if (!string.IsNullOrWhiteSpace(q.Protection))
            query = query.Where(c => c.ProtectionsApplied.Any(p => p.Name == q.Protection));

        var total = await query.CountAsync(ct);

        query = q.Sort switch
        {
            "downloads" => query.OrderByDescending(c => c.DownloadCount),
            "difficulty" => query.OrderByDescending(c => c.AuthorDifficulty),
            _ => query.OrderByDescending(c => c.PublishedAt ?? c.CreatedAt),
        };

        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 100);

        var rows = await query.Skip((page - 1) * size).Take(size)
            .Select(c => new Row(
                c,
                c.Solutions.Count(s => s.Status == SolutionStatus.Approved),
                c.Comments.Count(x => !x.IsDeleted && !x.IsHidden)))
            .ToListAsync(ct);

        var items = rows.Select(r => ToListItem(r.Crackme, r.SolutionCount, r.CommentCount)).ToList();
        return new CrackmeListResponse(items, total, page, size);
    }

    [HttpGet("{slug}")]
    public async Task<ActionResult<CrackmeDetail>> Detail(string slug, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var c = await db.Crackmes.AsNoTracking().Where(Public).FirstOrDefaultAsync(x => x.Slug == slug, ct);
        return c is null ? NotFound() : ToDetail(c);
    }

    [HttpGet("{slug}/download")]
    public async Task<IActionResult> Download(string slug, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var c = await db.Crackmes.AsNoTracking().Where(Public).FirstOrDefaultAsync(x => x.Slug == slug, ct);
        if (c is null)
            return NotFound();

        var stream = await storage.OpenReadAsync(c.StorageKey, ct);
        if (stream is null)
            return NotFound("File is no longer available.");

        byte[] zip;
        await using (stream)
        {
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms, ct);
            zip = PasswordZip.Create(c.OriginalFileName ?? $"{c.Slug}.bin", ms.ToArray(), cfg["Crackmes:ZipPassword"] ?? "bitmono.dev");
        }

        await db.Crackmes.Where(x => x.Id == c.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.DownloadCount, x => x.DownloadCount + 1), ct);

        return File(zip, "application/zip", $"{c.Slug}.zip");
    }

    private static readonly Expression<Func<Crackme, bool>> Public =
        c => c.Status == CrackmeStatus.Approved && !c.IsTakenDown;

    private sealed record Row(Crackme Crackme, int SolutionCount, int CommentCount);

    private static CrackmeListItem ToListItem(Crackme c, int solutions, int comments) => new(
        c.Slug, c.Title, c.AnonymousHandle ?? "anonymous",
        c.TargetPlatform, c.DotnetRuntime, c.Language,
        c.AuthorDifficulty, Avg(c.DifficultySum, c.DifficultyCount), Avg(c.QualitySum, c.QualityCount),
        c.SizeBytes, c.DownloadCount, c.SolvedCount, solutions, comments,
        c.IsBitMonoObfuscated, EnabledProtections(c), c.PublishedAt ?? c.CreatedAt);

    private static CrackmeDetail ToDetail(Crackme c) => new(
        c.Slug, c.Title, c.Description, c.AnonymousHandle ?? "anonymous",
        c.TargetPlatform, c.DotnetRuntime, c.Language,
        c.AuthorDifficulty, Avg(c.DifficultySum, c.DifficultyCount), c.DifficultyCount,
        Avg(c.QualitySum, c.QualityCount), c.QualityCount,
        c.SizeBytes, c.OriginalFileName, c.DownloadCount, c.SolvedCount,
        c.IsBitMonoObfuscated, c.Preset, EnabledProtections(c), c.PublishedAt ?? c.CreatedAt);

    private static List<string> EnabledProtections(Crackme c) =>
        c.ProtectionsApplied.Where(p => p.Enabled).Select(p => p.Name).ToList();

    private static double? Avg(int sum, int count) => count > 0 ? Math.Round((double)sum / count, 1) : null;
}

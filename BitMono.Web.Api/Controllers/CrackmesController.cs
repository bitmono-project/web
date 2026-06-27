using System.Linq.Expressions;
using System.Security.Claims;
using BitMono.Web.Api.Models;
using BitMono.Web.Api.Storage;
using BitMono.Web.Data;
using BitMono.Web.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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

    [HttpGet("{slug}/comments")]
    public async Task<ActionResult<IReadOnlyList<CommentItem>>> Comments(string slug, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var id = await PublicIdAsync(db, slug, ct);
        if (id is null)
            return NotFound();

        var comments = await db.Comments.AsNoTracking()
            .Where(c => c.CrackmeId == id && !c.IsDeleted && !c.IsHidden)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new CommentItem(c.Id, c.AnonymousHandle ?? "anonymous", c.Body, c.IsSpoiler, c.CreatedAt))
            .ToListAsync(ct);
        return Ok(comments);
    }

    [HttpPost("{slug}/comments")]
    [Authorize]
    [EnableRateLimiting("comment")]
    public async Task<ActionResult<CommentItem>> AddComment(string slug, [FromBody] CommentCreateRequest req, CancellationToken ct)
    {
        var body = req.Body?.Trim();
        if (string.IsNullOrEmpty(body))
            return BadRequest("Comment can't be empty.");
        if (body.Length > 4000)
            body = body[..4000];

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var crackme = await db.Crackmes.AsNoTracking().Where(Public).FirstOrDefaultAsync(c => c.Slug == slug, ct);
        if (crackme is null)
            return NotFound();

        var now = DateTime.UtcNow;
        var comment = new Comment
        {
            Id = Guid.NewGuid(),
            CrackmeId = crackme.Id,
            AuthorUserId = Guid.Parse(User.FindFirstValue("uid")!),
            AnonymousHandle = User.Identity?.Name ?? "anonymous",
            Body = body,
            IsSpoiler = req.IsSpoiler,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Comments.Add(comment);
        await db.SaveChangesAsync(ct);
        return Ok(new CommentItem(comment.Id, comment.AnonymousHandle!, comment.Body, comment.IsSpoiler, comment.CreatedAt));
    }

    [HttpGet("{slug}/my-rating")]
    [Authorize]
    public async Task<ActionResult<MyRating>> GetMyRating(string slug, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var id = await PublicIdAsync(db, slug, ct);
        if (id is null)
            return NotFound();

        var uid = Guid.Parse(User.FindFirstValue("uid")!);
        var rating = await db.Ratings.AsNoTracking().FirstOrDefaultAsync(r => r.CrackmeId == id && r.VoterUserId == uid, ct);
        return Ok(new MyRating(rating?.Difficulty, rating?.Quality));
    }

    [HttpPost("{slug}/rate")]
    [Authorize]
    public async Task<ActionResult<RatingResult>> Rate(string slug, [FromBody] RatingRequest req, CancellationToken ct)
    {
        if (req.Difficulty is < 1 or > 6 || req.Quality is < 1 or > 6)
            return BadRequest("Difficulty and quality must be 1–6.");

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var crackme = await db.Crackmes.Where(Public).FirstOrDefaultAsync(c => c.Slug == slug, ct);
        if (crackme is null)
            return NotFound();

        var uid = Guid.Parse(User.FindFirstValue("uid")!);
        var rating = await db.Ratings.FirstOrDefaultAsync(r => r.CrackmeId == crackme.Id && r.VoterUserId == uid, ct);
        var now = DateTime.UtcNow;

        if (rating is null)
        {
            db.Ratings.Add(new Rating
            {
                Id = Guid.NewGuid(),
                CrackmeId = crackme.Id,
                VoterUserId = uid,
                Difficulty = req.Difficulty,
                Quality = req.Quality,
                CreatedAt = now,
                UpdatedAt = now,
            });
            crackme.DifficultySum += req.Difficulty;
            crackme.DifficultyCount++;
            crackme.QualitySum += req.Quality;
            crackme.QualityCount++;
        }
        else
        {
            crackme.DifficultySum += req.Difficulty - rating.Difficulty;
            crackme.QualitySum += req.Quality - rating.Quality;
            rating.Difficulty = req.Difficulty;
            rating.Quality = req.Quality;
            rating.UpdatedAt = now;
        }
        crackme.UpdatedAt = now;
        await db.SaveChangesAsync(ct);

        return Ok(new RatingResult(
            Avg(crackme.DifficultySum, crackme.DifficultyCount), crackme.DifficultyCount,
            Avg(crackme.QualitySum, crackme.QualityCount), crackme.QualityCount));
    }

    private static async Task<Guid?> PublicIdAsync(CrackmesDbContext db, string slug, CancellationToken ct)
    {
        var match = await db.Crackmes.AsNoTracking().Where(Public)
            .Where(x => x.Slug == slug).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        return match;
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

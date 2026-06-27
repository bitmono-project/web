using System.Linq.Expressions;
using System.Security.Claims;
using System.Security.Cryptography;
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
        if (c is null)
            return NotFound();

        var uid = CurrentUserId();
        var raw = await db.Reactions.AsNoTracking()
            .Where(r => r.TargetType == ModeratableType.Crackme && r.TargetId == c.Id)
            .Select(r => new ReactionRow(r.Emoji, r.UserId)).ToListAsync(ct);
        var counts = raw.GroupBy(r => r.Emoji).ToDictionary(g => g.Key, g => g.Count());
        var mine = uid is null ? [] : raw.Where(r => r.UserId == uid).Select(r => r.Emoji).ToList();

        return ToDetail(c, isOwner: uid is not null && uid == c.UploaderUserId, counts, mine);
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

        var rows = await db.Comments.AsNoTracking()
            .Where(c => c.CrackmeId == id && !c.IsDeleted && !c.IsHidden)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new CommentRow(c.Id, c.AnonymousHandle, c.Body, c.IsSpoiler, c.CreatedAt))
            .ToListAsync(ct);

        var ids = rows.Select(r => r.Id).ToList();
        var reactions = await db.Reactions.AsNoTracking()
            .Where(r => r.TargetType == ModeratableType.Comment && ids.Contains(r.TargetId))
            .Select(r => new CommentReactionRow(r.TargetId, r.Emoji, r.UserId)).ToListAsync(ct);
        var uid = CurrentUserId();

        var items = rows.Select(r =>
        {
            var rs = reactions.Where(x => x.TargetId == r.Id).ToList();
            var counts = rs.GroupBy(x => x.Emoji).ToDictionary(g => g.Key, g => g.Count());
            IReadOnlyList<string> myReactions = uid is null
                ? []
                : rs.Where(x => x.UserId == uid).Select(x => x.Emoji).ToList();
            return new CommentItem(r.Id, r.Author ?? AppConstants.AnonymousHandle, r.Body, r.IsSpoiler, r.CreatedAt, counts, myReactions);
        }).ToList();
        return Ok(items);
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
            AnonymousHandle = User.Identity?.Name ?? AppConstants.AnonymousHandle,
            Body = body,
            IsSpoiler = req.IsSpoiler,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Comments.Add(comment);
        await db.SaveChangesAsync(ct);
        return Ok(new CommentItem(comment.Id, comment.AnonymousHandle!, comment.Body, comment.IsSpoiler, comment.CreatedAt,
            new Dictionary<string, int>(), []));
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

    [HttpPatch("{slug}/settings")]
    [Authorize]
    public async Task<IActionResult> UpdateSettings(string slug, [FromBody] CrackmeSettingsRequest req, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var c = await db.Crackmes.FirstOrDefaultAsync(x => x.Slug == slug, ct);
        if (c is null)
            return NotFound();
        if (c.UploaderUserId != CurrentUserId()
            && !User.IsInRole(nameof(UserRole.Moderator)) && !User.IsInRole(nameof(UserRole.Admin)))
            return Forbid();

        c.ReactionsEnabled = req.ReactionsEnabled;
        c.CommentReactionsEnabled = req.CommentReactionsEnabled;
        c.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("{slug}/writeups")]
    public async Task<ActionResult<IReadOnlyList<WriteupItem>>> Writeups(string slug, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var id = await PublicIdAsync(db, slug, ct);
        if (id is null)
            return NotFound();

        var writeups = await db.Solutions.AsNoTracking()
            .Where(s => s.CrackmeId == id && s.Status == SolutionStatus.Approved)
            .OrderByDescending(s => s.UpvoteCount).ThenBy(s => s.CreatedAt)
            .Select(s => new WriteupItem(s.Id, s.AnonymousHandle ?? AppConstants.AnonymousHandle, s.Title, s.BodyMarkdown, s.HasAttachment, s.UpvoteCount, s.CreatedAt))
            .ToListAsync(ct);
        return Ok(writeups);
    }

    [HttpPost("{slug}/writeups")]
    [Authorize]
    [EnableRateLimiting("upload")]
    public async Task<ActionResult<WriteupResponse>> AddWriteup(string slug, [FromForm] WriteupForm form, CancellationToken ct)
    {
        var body = form.BodyMarkdown?.Trim();
        if (string.IsNullOrEmpty(body))
            return BadRequest("Writeup body is required.");
        if (body.Length > 40000)
            body = body[..40000];

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var crackme = await db.Crackmes.AsNoTracking().Where(Public).FirstOrDefaultAsync(c => c.Slug == slug, ct);
        if (crackme is null)
            return NotFound();

        var id = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var solution = new Solution
        {
            Id = id,
            CrackmeId = crackme.Id,
            AuthorUserId = Guid.Parse(User.FindFirstValue("uid")!),
            AnonymousHandle = User.Identity?.Name ?? AppConstants.AnonymousHandle,
            Title = string.IsNullOrWhiteSpace(form.Title) ? null : form.Title.Trim(),
            BodyMarkdown = body,
            Status = SolutionStatus.Pending,
            CreatedAt = now,
            UpdatedAt = now,
        };

        var file = form.Attachment;
        if (file is { Length: > 0 })
        {
            var max = cfg.GetValue<long?>("Crackmes:MaxUploadBytes") ?? 10 * 1024 * 1024;
            if (file.Length > max)
                return BadRequest($"Attachment must be under {max / (1024 * 1024)} MB.");
            await using var ms = new MemoryStream();
            await file.CopyToAsync(ms, ct);
            var bytes = ms.ToArray();
            var key = $"writeups/{id:N}/{SanitizeFileName(file.FileName)}";
            await storage.SaveAsync(key, new MemoryStream(bytes, writable: false), ct);
            solution.HasAttachment = true;
            solution.StorageKey = key;
            solution.Sha256 = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
            solution.SizeBytes = file.Length;
        }

        db.Solutions.Add(solution);
        await db.SaveChangesAsync(ct);
        return Accepted(new WriteupResponse(id, "pending"));
    }

    [HttpGet("{slug}/writeups/{id:guid}/attachment")]
    public async Task<IActionResult> WriteupAttachment(string slug, Guid id, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var s = await db.Solutions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.Status == SolutionStatus.Approved, ct);
        if (s is null || !s.HasAttachment || s.StorageKey is null)
            return NotFound();

        var stream = await storage.OpenReadAsync(s.StorageKey, ct);
        if (stream is null)
            return NotFound("Attachment is no longer available.");
        await using (stream)
        {
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms, ct);
            var zip = PasswordZip.Create(Path.GetFileName(s.StorageKey), ms.ToArray(), cfg["Crackmes:ZipPassword"] ?? "bitmono.dev");
            return File(zip, "application/zip", $"{slug}-writeup.zip");
        }
    }

    private static string SanitizeFileName(string name)
    {
        var clean = Path.GetFileName(name);
        foreach (var c in Path.GetInvalidFileNameChars())
            clean = clean.Replace(c, '_');
        return string.IsNullOrWhiteSpace(clean) ? "attachment.bin" : clean;
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
        c.Slug, c.Title, c.AnonymousHandle ?? AppConstants.AnonymousHandle,
        c.TargetPlatform, c.DotnetRuntime, c.Language,
        c.AuthorDifficulty, Avg(c.DifficultySum, c.DifficultyCount), Avg(c.QualitySum, c.QualityCount),
        c.SizeBytes, c.DownloadCount, c.SolvedCount, solutions, comments,
        c.IsBitMonoObfuscated, EnabledProtections(c), c.PublishedAt ?? c.CreatedAt);

    private static CrackmeDetail ToDetail(Crackme c, bool isOwner, IReadOnlyDictionary<string, int> reactions, IReadOnlyList<string> myReactions) => new(
        c.Slug, c.Title, c.Description, c.AnonymousHandle ?? AppConstants.AnonymousHandle,
        c.TargetPlatform, c.DotnetRuntime, c.Language,
        c.AuthorDifficulty, Avg(c.DifficultySum, c.DifficultyCount), c.DifficultyCount,
        Avg(c.QualitySum, c.QualityCount), c.QualityCount,
        c.SizeBytes, c.OriginalFileName, c.DownloadCount, c.SolvedCount,
        c.IsBitMonoObfuscated, c.Preset, EnabledProtections(c), c.PublishedAt ?? c.CreatedAt,
        isOwner, c.ReactionsEnabled, c.CommentReactionsEnabled, reactions, myReactions);

    private Guid? CurrentUserId() =>
        User.Identity?.IsAuthenticated == true && Guid.TryParse(User.FindFirstValue("uid"), out var id) ? id : null;

    private static List<string> EnabledProtections(Crackme c) =>
        c.ProtectionsApplied.Where(p => p.Enabled).Select(p => p.Name).ToList();

    private static double? Avg(int sum, int count) => count > 0 ? Math.Round((double)sum / count, 1) : null;
}

using System.Linq.Expressions;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using BitMono.Web.Api.Models;
using BitMono.Web.Api.Notifications;
using BitMono.Web.Api.Progression;
using BitMono.Web.Api.Storage;
using BitMono.Web.Api.Verification;
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
                c.Comments.Count(x => !x.IsDeleted && !x.IsHidden),
                c.UploaderUserId == null ? null : db.Users.Where(u => u.Id == c.UploaderUserId).Select(u => u.Handle).FirstOrDefault()))
            .ToListAsync(ct);

        var items = rows.Select(r => ToListItem(r.Crackme, r.SolutionCount, r.CommentCount, r.AuthorHandle)).ToList();
        return new CrackmeListResponse(items, total, page, size);
    }

    // The uploader's own submissions, including pending/rejected/taken-down ones the public can't see,
    // plus the moderator's message so they know why something wasn't approved.
    [HttpGet("mine")]
    [Authorize]
    public async Task<IReadOnlyList<MySubmission>> Mine(CancellationToken ct)
    {
        var uid = CurrentUserId();
        if (uid is null)
            return [];

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        return await db.Crackmes.AsNoTracking()
            .Where(c => c.UploaderUserId == uid)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new MySubmission(
                c.Slug, c.Title, c.Status, c.PublicModeratorMessage,
                c.IsTakenDown, c.TakedownReason, c.TakenDownAt,
                c.DownloadCount, c.SolvedCount, c.CreatedAt, c.PublishedAt))
            .ToListAsync(ct);
    }

    [HttpGet("{slug}")]
    public async Task<ActionResult<CrackmeDetail>> Detail(string slug, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        // Fetch without the Public filter so a taken-down crackme returns a tombstone (with the reason)
        // instead of a bare 404. Pending/rejected stay hidden — the owner sees those via /api/crackmes/mine.
        var c = await db.Crackmes.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == slug, ct);
        if (c is null)
            return NotFound();
        if (c.IsTakenDown)
        {
            var takedownHandle = c.UploaderUserId is { } downUp
                ? await db.Users.AsNoTracking().Where(u => u.Id == downUp).Select(u => u.Handle).FirstOrDefaultAsync(ct)
                : null;
            return Tombstone(c, takedownHandle);
        }
        // Moderators/admins can open a not-yet-approved (pending/rejected) crackme to preview the full page;
        // the public still gets 404 for anything that isn't Approved.
        var isStaff = User.IsInRole(nameof(UserRole.Moderator)) || User.IsInRole(nameof(UserRole.Admin));
        if (c.Status != CrackmeStatus.Approved && !isStaff)
            return NotFound();

        var uid = CurrentUserId();
        var raw = await db.Reactions.AsNoTracking()
            .Where(r => r.TargetType == ModeratableType.Crackme && r.TargetId == c.Id)
            .Select(r => new ReactionRow(r.Emoji, r.UserId)).ToListAsync(ct);
        var counts = raw.GroupBy(r => r.Emoji).ToDictionary(g => g.Key, g => g.Count());
        var mine = uid is null ? [] : raw.Where(r => r.UserId == uid).Select(r => r.Emoji).ToList();
        var solvedByMe = uid is not null && await db.Solves.AsNoTracking().AnyAsync(x => x.UserId == uid && x.CrackmeId == c.Id, ct);
        var authorHandle = c.UploaderUserId is { } up
            ? await db.Users.AsNoTracking().Where(u => u.Id == up).Select(u => u.Handle).FirstOrDefaultAsync(ct)
            : null;

        return ToDetail(c, isOwner: uid is not null && uid == c.UploaderUserId, counts, mine, solvedByMe, authorHandle);
    }

    // Public takedown/restore trail for a crackme — visible to everyone so removals/restores are transparent.
    // The acting moderator's real name is revealed only to admins; everyone else sees "a moderator".
    [HttpGet("{slug}/moderation-history")]
    public async Task<ActionResult<IReadOnlyList<ModerationEvent>>> ModerationHistory(string slug, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var crackmeId = await db.Crackmes.AsNoTracking()
            .Where(x => x.Slug == slug && (x.Status == CrackmeStatus.Approved || x.Status == CrackmeStatus.TakenDown))
            .Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        if (crackmeId is null)
            return NotFound();

        var rows = await db.ModerationReviews.AsNoTracking()
            .Where(r => r.CrackmeId == crackmeId && (r.IsTakedown || r.Verdict == ModerationVerdict.Restored))
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new { r.IsTakedown, r.TakedownReason, r.PublicMessage, r.CreatedAt, r.ReviewerId })
            .ToListAsync(ct);

        var isAdmin = User.IsInRole(nameof(UserRole.Admin));
        var names = new Dictionary<Guid, string>();
        if (isAdmin && rows.Count > 0)
        {
            var ids = rows.Select(r => r.ReviewerId).Distinct().ToList();
            names = await db.Users.AsNoTracking()
                .Where(u => ids.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.DisplayName, ct);
        }

        var events = rows.Select(r => new ModerationEvent(
            r.IsTakedown ? ModerationEventAction.TakenDown : ModerationEventAction.Restored,
            r.IsTakedown ? r.TakedownReason : r.PublicMessage,
            r.CreatedAt,
            isAdmin && names.TryGetValue(r.ReviewerId, out var n) ? n : null)).ToList();

        return Ok(events);
    }

    [HttpPost("{slug}/solve")]
    [Authorize]
    [EnableRateLimiting("comment")]
    public async Task<ActionResult<SolveResult>> Solve(string slug, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var c = await db.Crackmes.AsNoTracking().Where(Public).FirstOrDefaultAsync(x => x.Slug == slug, ct);
        if (c is null)
            return NotFound();

        var uid = Guid.Parse(User.FindFirstValue("uid")!);
        if (c.UploaderUserId == uid)
            return BadRequest("You can't mark your own crackme as solved.");
        if (c.VerificationKind != VerificationKind.None)
            return BadRequest("This crackme requires submitting the correct answer — use Submit flag.");

        var solve = await SolveRecorder.TryRecordAsync(db, c, uid, SolveSource.SelfReported, ct);
        var solvedCount = await db.Crackmes.Where(x => x.Id == c.Id).Select(x => x.SolvedCount).FirstAsync(ct);
        return Ok(new SolveResult(true, solvedCount, solve?.IsFirstBlood ?? false, solve?.PointsAwarded ?? 0));
    }

    [HttpDelete("{slug}/solve")]
    [Authorize]
    [EnableRateLimiting("comment")]
    public async Task<ActionResult<SolveResult>> Unsolve(string slug, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var id = await PublicIdAsync(db, slug, ct);
        if (id is null)
            return NotFound();

        var uid = Guid.Parse(User.FindFirstValue("uid")!);
        await SolveRecorder.RemoveAsync(db, id.Value, uid, ct);
        var solvedCount = await db.Crackmes.Where(x => x.Id == id.Value).Select(x => x.SolvedCount).FirstAsync(ct);
        return Ok(new SolveResult(false, solvedCount, false, 0));
    }

    // Owner/admin sets (or clears) the solve answer. The raw answer is never stored — Exact* kinds keep
    // only a PBKDF2 hash; Regex keeps the pattern. Switching to None clears everything.
    [HttpPut("{slug}/verification")]
    [Authorize]
    public async Task<IActionResult> SetVerification(string slug, [FromBody] VerificationRequest req, CancellationToken ct)
    {
        if (!Enum.TryParse<VerificationKind>(req.Kind, ignoreCase: true, out var kind))
            return BadRequest("Unknown verification kind.");

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var c = await db.Crackmes.FirstOrDefaultAsync(x => x.Slug == slug, ct);
        if (c is null)
            return NotFound();
        if (c.UploaderUserId != CurrentUserId()
            && !User.IsInRole(nameof(UserRole.Moderator)) && !User.IsInRole(nameof(UserRole.Admin)))
            return Forbid();

        var answer = req.Answer?.Trim();

        // Blank answer + same kind that already has a secret = "leave it as-is" — don't force a retype.
        if (string.IsNullOrEmpty(answer) && kind == c.VerificationKind && kind != VerificationKind.None)
            return NoContent();

        switch (kind)
        {
            case VerificationKind.None:
                c.VerificationHash = c.VerificationSalt = c.VerificationPattern = null;
                break;
            case VerificationKind.Regex:
                if (string.IsNullOrEmpty(answer))
                    return BadRequest("A regex pattern is required.");
                try { _ = new Regex(answer, RegexOptions.None, RegexMatchTimeout); }
                catch (ArgumentException) { return BadRequest("That isn't a valid regular expression."); }
                c.VerificationPattern = answer;
                c.VerificationHash = c.VerificationSalt = null;
                break;
            default: // ExactCaseInsensitive / ExactCaseSensitive
                if (string.IsNullOrEmpty(answer))
                    return BadRequest("An answer is required.");
                var normalized = kind == VerificationKind.ExactCaseInsensitive ? answer.ToLowerInvariant() : answer;
                (c.VerificationHash, c.VerificationSalt) = VerificationHasher.Hash(normalized);
                c.VerificationPattern = null;
                break;
        }
        c.VerificationKind = kind;
        c.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // A solver proves they cracked it. A wrong answer returns 200 { correct=false } (not an error) so the
    // UI can say "nope, try again" without console noise; a correct answer records a Verified solve.
    [HttpPost("{slug}/submit-flag")]
    [Authorize]
    [EnableRateLimiting("comment")]
    public async Task<ActionResult<FlagResult>> SubmitFlag(string slug, [FromBody] FlagSubmitRequest req, CancellationToken ct)
    {
        var answer = req.Answer?.Trim();
        if (string.IsNullOrEmpty(answer))
            return BadRequest("Enter an answer.");

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var c = await db.Crackmes.AsNoTracking().Where(Public).FirstOrDefaultAsync(x => x.Slug == slug, ct);
        if (c is null)
            return NotFound();
        if (c.VerificationKind == VerificationKind.None)
            return BadRequest("This crackme doesn't use answer verification.");

        var uid = Guid.Parse(User.FindFirstValue("uid")!);
        if (c.UploaderUserId == uid)
            return BadRequest("You can't solve your own crackme.");

        if (!IsAnswerCorrect(c, answer))
        {
            var current = await db.Crackmes.Where(x => x.Id == c.Id).Select(x => x.SolvedCount).FirstAsync(ct);
            return Ok(new FlagResult(false, current, false, 0));
        }

        var solve = await SolveRecorder.TryRecordAsync(db, c, uid, SolveSource.Verified, ct);
        var solvedCount = await db.Crackmes.Where(x => x.Id == c.Id).Select(x => x.SolvedCount).FirstAsync(ct);
        return Ok(new FlagResult(true, solvedCount, solve?.IsFirstBlood ?? false, solve?.PointsAwarded ?? 0));
    }

    // Author-supplied regex runs against solver input — cap it so a pathological pattern can't hang a request.
    private static readonly TimeSpan RegexMatchTimeout = TimeSpan.FromMilliseconds(100);

    private static bool IsAnswerCorrect(Crackme c, string answer) => c.VerificationKind switch
    {
        VerificationKind.ExactCaseInsensitive => c.VerificationHash is not null && c.VerificationSalt is not null
            && VerificationHasher.Verify(answer.ToLowerInvariant(), c.VerificationHash, c.VerificationSalt),
        VerificationKind.ExactCaseSensitive => c.VerificationHash is not null && c.VerificationSalt is not null
            && VerificationHasher.Verify(answer, c.VerificationHash, c.VerificationSalt),
        VerificationKind.Regex => c.VerificationPattern is not null && TryRegex(c.VerificationPattern, answer),
        _ => false,
    };

    private static bool TryRegex(string pattern, string answer)
    {
        try { return Regex.IsMatch(answer, pattern, RegexOptions.None, RegexMatchTimeout); }
        catch (RegexMatchTimeoutException) { return false; }
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
        try
        {
            await Notifier.NotifyAsync(db, crackme.UploaderUserId, NotificationType.CommentOnYourCrackme,
                $"New comment on '{crackme.Title}'", null, $"/challenge/{crackme.Slug}",
                Guid.Parse(User.FindFirstValue("uid")!), crackme.Id, ct);
        }
        catch { }
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

    [HttpPost("{slug}/report")]
    [EnableRateLimiting("comment")]
    public async Task<IActionResult> Report(string slug, [FromBody] ReportRequest req, CancellationToken ct)
    {
        if (!Enum.TryParse<ReportReason>(req.Reason, ignoreCase: true, out var reason))
            return BadRequest("Unknown report reason.");

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var id = await PublicIdAsync(db, slug, ct);
        if (id is null)
            return NotFound();

        db.Reports.Add(new Report
        {
            Id = Guid.NewGuid(),
            TargetType = ModeratableType.Crackme,
            TargetId = id.Value,
            CrackmeId = id.Value,
            ReporterUserId = CurrentUserId(),
            ReporterIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
            Reason = reason,
            Details = req.Details is { Length: > 2000 } d ? d[..2000] : req.Details,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);
        return Accepted();
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
        try
        {
            await Notifier.NotifyAsync(db, crackme.UploaderUserId, NotificationType.WriteupOnYourCrackme,
                $"New writeup on '{crackme.Title}'", null, $"/challenge/{crackme.Slug}",
                Guid.Parse(User.FindFirstValue("uid")!), crackme.Id, ct);
        }
        catch { }
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

    private sealed record Row(Crackme Crackme, int SolutionCount, int CommentCount, string? AuthorHandle);

    private static CrackmeListItem ToListItem(Crackme c, int solutions, int comments, string? authorHandle) => new(
        c.Slug, c.Title, c.AnonymousHandle ?? AppConstants.AnonymousHandle,
        c.TargetPlatform, c.DotnetRuntime, c.Language,
        c.AuthorDifficulty, Avg(c.DifficultySum, c.DifficultyCount), Avg(c.QualitySum, c.QualityCount),
        c.SizeBytes, c.DownloadCount, c.SolvedCount, solutions, comments,
        c.IsBitMonoObfuscated, EnabledProtections(c), c.PublishedAt ?? c.CreatedAt, authorHandle);

    private static CrackmeDetail ToDetail(Crackme c, bool isOwner, IReadOnlyDictionary<string, int> reactions, IReadOnlyList<string> myReactions, bool solvedByMe, string? authorHandle) => new(
        c.Id, c.Slug, c.Title, c.Description, c.AnonymousHandle ?? AppConstants.AnonymousHandle,
        c.TargetPlatform, c.DotnetRuntime, c.Language,
        c.AuthorDifficulty, Avg(c.DifficultySum, c.DifficultyCount), c.DifficultyCount,
        Avg(c.QualitySum, c.QualityCount), c.QualityCount,
        c.SizeBytes, c.OriginalFileName, c.DownloadCount, c.SolvedCount,
        c.IsBitMonoObfuscated, c.Preset, EnabledProtections(c), c.PublishedAt ?? c.CreatedAt,
        isOwner, c.ReactionsEnabled, c.CommentReactionsEnabled, reactions, myReactions,
        c.Status, c.TakedownReason, c.TakenDownAt, solvedByMe, authorHandle, c.VerificationKind);

    // A stripped-down detail for a taken-down crackme: keep title/author so the page still means
    // something, but drop description/download/reactions and surface the takedown reason.
    private static CrackmeDetail Tombstone(Crackme c, string? authorHandle) => new(
        c.Id, c.Slug, c.Title, Description: null, c.AnonymousHandle ?? AppConstants.AnonymousHandle,
        c.TargetPlatform, c.DotnetRuntime, c.Language,
        c.AuthorDifficulty, AvgDifficulty: null, DifficultyCount: 0,
        AvgQuality: null, QualityCount: 0,
        SizeBytes: 0, OriginalFileName: null, DownloadCount: c.DownloadCount, SolvedCount: c.SolvedCount,
        IsBitMonoObfuscated: false, Preset: ObfuscationPreset.Custom, Protections: [],
        PublishedAt: c.PublishedAt ?? c.CreatedAt, IsOwner: false,
        ReactionsEnabled: false, CommentReactionsEnabled: false,
        Reactions: new Dictionary<string, int>(), MyReactions: [],
        Status: CrackmeStatus.TakenDown, TakedownReason: c.TakedownReason, TakenDownAt: c.TakenDownAt,
        SolvedByMe: false, AuthorHandle: authorHandle, VerificationKind: VerificationKind.None);

    private Guid? CurrentUserId() =>
        User.Identity?.IsAuthenticated == true && Guid.TryParse(User.FindFirstValue("uid"), out var id) ? id : null;

    private static List<string> EnabledProtections(Crackme c) =>
        c.ProtectionsApplied.Where(p => p.Enabled).Select(p => p.Name).ToList();

    private static double? Avg(int sum, int count) => count > 0 ? Math.Round((double)sum / count, 1) : null;
}

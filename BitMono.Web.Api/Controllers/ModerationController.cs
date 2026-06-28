using System.Security.Claims;
using BitMono.Web.Api.Auth;
using BitMono.Web.Api.Badges;
using BitMono.Web.Api.Models;
using BitMono.Web.Api.Notifications;
using BitMono.Web.Api.Progression;
using BitMono.Web.Api.Storage;
using BitMono.Web.Data;
using BitMono.Web.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Controllers;

[ApiController]
[Route("api/moderation")]
[Authorize(Policy = AuthSetup.ModeratorPolicy)]
public sealed class ModerationController(IServiceScopeFactory scopeFactory, BlobStorage storage, IConfiguration cfg) : ControllerBase
{
    [HttpGet("queue")]
    public async Task<IReadOnlyList<PendingItem>> Queue(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var rows = await db.Crackmes.AsNoTracking()
            .Where(c => c.Status == CrackmeStatus.Pending)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync(ct);

        return rows.Select(c => new PendingItem(
            c.Id, c.Slug, c.Title, c.Description, c.AnonymousHandle ?? AppConstants.AnonymousHandle,
            c.TargetPlatform, c.DotnetRuntime, c.Language, c.AuthorDifficulty,
            c.SizeBytes, c.Sha256, c.IsBitMonoObfuscated,
            c.ProtectionsApplied.Where(p => p.Enabled).Select(p => p.Name).ToList(), c.CreatedAt)).ToList();
    }

    // Moderators download the (still-private) file to inspect it before approving.
    [HttpGet("{id:guid}/file")]
    public async Task<IActionResult> File(Guid id, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var c = await db.Crackmes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null)
            return NotFound();

        var stream = await storage.OpenReadAsync(c.StorageKey, ct);
        if (stream is null)
            return NotFound("File missing from storage.");

        await using (stream)
        {
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms, ct);
            var zip = PasswordZip.Create(c.OriginalFileName ?? $"{c.Slug}.bin", ms.ToArray(), cfg["Crackmes:ZipPassword"] ?? "bitmono.dev");
            return File(zip, "application/zip", $"{c.Slug}.zip");
        }
    }

    [HttpPost("{id:guid}/approve")]
    public Task<IActionResult> Approve(Guid id, CancellationToken ct) => ActAsync(id, approve: true, null, ct);

    [HttpPost("{id:guid}/reject")]
    public Task<IActionResult> Reject(Guid id, [FromBody] ModerationActionRequest? req, CancellationToken ct) =>
        ActAsync(id, approve: false, req?.Message, ct);

    // Take a live crackme down (soft-delete). Admin-only: the AdminPolicy here stacks on top of the
    // controller's ModeratorPolicy, so a plain Moderator gets 403. The reason is shown publicly.
    [HttpPost("{id:guid}/takedown")]
    [Authorize(Policy = AuthSetup.AdminPolicy)]
    public async Task<IActionResult> Takedown(Guid id, [FromBody] TakedownRequest? req, CancellationToken ct)
    {
        var reason = req?.Reason?.Trim();
        if (string.IsNullOrEmpty(reason))
            return BadRequest("A takedown reason is required.");
        if (reason.Length > 1000)
            reason = reason[..1000];

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var c = await db.Crackmes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null)
            return NotFound();

        var now = DateTime.UtcNow;
        c.IsTakenDown = true;
        c.TakenDownAt = now;
        c.TakedownReason = reason;
        c.Status = CrackmeStatus.TakenDown;
        c.CurrentVerdict = ModerationVerdict.TakenDown;
        c.UpdatedAt = now;

        db.ModerationReviews.Add(new ModerationReview
        {
            Id = Guid.NewGuid(),
            TargetType = ModeratableType.Crackme,
            TargetId = c.Id,
            CrackmeId = c.Id,
            ReviewerId = Guid.Parse(User.FindFirstValue("uid")!),
            Verdict = ModerationVerdict.TakenDown,
            TakedownReason = reason,
            IsTakedown = true,
            CreatedAt = now,
        });
        await db.SaveChangesAsync(ct);
        try
        {
            await Notifier.NotifyAsync(db, c.UploaderUserId, NotificationType.TakenDown,
                $"'{c.Title}' was taken down", reason, "/submissions",
                Guid.Parse(User.FindFirstValue("uid")!), c.Id, ct);
        }
        catch { }
        return NoContent();
    }

    // Undo a takedown — restores the crackme to the public gallery.
    [HttpPost("{id:guid}/restore")]
    [Authorize(Policy = AuthSetup.AdminPolicy)]
    public async Task<IActionResult> Restore(Guid id, [FromBody] RestoreRequest? req, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var c = await db.Crackmes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null)
            return NotFound();

        var reason = req?.Reason?.Trim();
        if (reason is { Length: > 1000 })
            reason = reason[..1000];

        var now = DateTime.UtcNow;
        c.IsTakenDown = false;
        c.TakenDownAt = null;
        c.TakedownReason = null;
        c.Status = CrackmeStatus.Approved;
        c.CurrentVerdict = ModerationVerdict.Approved;
        c.PublishedAt ??= now;
        c.UpdatedAt = now;

        db.ModerationReviews.Add(new ModerationReview
        {
            Id = Guid.NewGuid(),
            TargetType = ModeratableType.Crackme,
            TargetId = c.Id,
            CrackmeId = c.Id,
            ReviewerId = Guid.Parse(User.FindFirstValue("uid")!),
            Verdict = ModerationVerdict.Restored,
            PublicMessage = reason,
            IsTakedown = false,
            CreatedAt = now,
        });
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("writeups")]
    public async Task<IReadOnlyList<PendingWriteup>> WriteupQueue(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        return await db.Solutions.AsNoTracking()
            .Where(s => s.Status == SolutionStatus.Pending)
            .OrderBy(s => s.CreatedAt)
            .Select(s => new PendingWriteup(
                s.Id, s.Crackme.Slug, s.Crackme.Title, s.AnonymousHandle ?? AppConstants.AnonymousHandle,
                s.Title, s.BodyMarkdown, s.HasAttachment, s.CreatedAt))
            .ToListAsync(ct);
    }

    [HttpGet("writeups/{id:guid}/attachment")]
    public async Task<IActionResult> WriteupAttachment(Guid id, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var s = await db.Solutions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (s is null || !s.HasAttachment || s.StorageKey is null)
            return NotFound();
        var stream = await storage.OpenReadAsync(s.StorageKey, ct);
        if (stream is null)
            return NotFound("Attachment missing from storage.");
        await using (stream)
        {
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms, ct);
            var zip = PasswordZip.Create(Path.GetFileName(s.StorageKey), ms.ToArray(), cfg["Crackmes:ZipPassword"] ?? "bitmono.dev");
            return File(zip, "application/zip", "writeup.zip");
        }
    }

    [HttpPost("writeups/{id:guid}/approve")]
    public async Task<IActionResult> ApproveWriteup(Guid id, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var s = await db.Solutions.Include(x => x.Crackme).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (s is null)
            return NotFound();
        var newlyApproved = s.Status != SolutionStatus.Approved;
        if (newlyApproved)
        {
            s.Status = SolutionStatus.Approved;
            s.UpdatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync(ct);
        // An approved writeup credits its author as a solver — SolvedCount is now COUNT(Solve),
        // bumped here via the recorder (replacing the old direct SolvedCount++).
        if (newlyApproved && s.AuthorUserId is { } author)
        {
            await SolveRecorder.TryRecordAsync(db, s.Crackme, author, SolveSource.Writeup, ct);
            try
            {
                var writeups = await db.Solutions.AsNoTracking()
                    .CountAsync(x => x.AuthorUserId == author && x.Status == SolutionStatus.Approved, ct);
                if (writeups >= 3)
                    await BadgeService.TryAwardAsync(db, author, BadgeService.Professor, ct);
            }
            catch { }
        }
        return NoContent();
    }

    [HttpPost("writeups/{id:guid}/reject")]
    public async Task<IActionResult> RejectWriteup(Guid id, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var s = await db.Solutions.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (s is null)
            return NotFound();
        s.Status = SolutionStatus.Rejected;
        s.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("reports")]
    public async Task<IReadOnlyList<PendingReport>> ReportQueue(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        return await db.Reports.AsNoTracking()
            .Where(r => !r.IsResolved && r.CrackmeId != null)
            .OrderBy(r => r.CreatedAt)
            .Select(r => new PendingReport(
                r.Id, r.Crackme!.Slug, r.Crackme.Title, r.Reason, r.Details,
                r.ReporterIp ?? AppConstants.AnonymousHandle, r.CreatedAt))
            .ToListAsync(ct);
    }

    [HttpPost("reports/{id:guid}/resolve")]
    public async Task<IActionResult> ResolveReport(Guid id, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
        var r = await db.Reports.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (r is null)
            return NotFound();
        r.IsResolved = true;
        r.ResolvedByUserId = Guid.Parse(User.FindFirstValue("uid")!);
        r.ResolvedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // Admin dashboard analytics — counts by status, totals, recent activity and a top-downloaded list.
    [HttpGet("stats")]
    [Authorize(Policy = AuthSetup.AdminPolicy)]
    public async Task<ModerationStats> Stats(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var now = DateTime.UtcNow;
        var weekAgo = now.AddDays(-7);
        var monthAgo = now.AddDays(-30);
        var chartSince = now.AddDays(-13).Date;

        var byStatus = await db.Crackmes.AsNoTracking()
            .GroupBy(c => c.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        int CountOf(CrackmeStatus s) => byStatus.FirstOrDefault(x => x.Status == s)?.Count ?? 0;

        // Npgsql can't translate GroupBy(c => c.CreatedAt.Date) — pull the raw timestamps for the
        // small 14-day window and bucket them by day in memory.
        var recent = await db.Crackmes.AsNoTracking()
            .Where(c => c.CreatedAt >= chartSince)
            .Select(c => c.CreatedAt)
            .ToListAsync(ct);
        var byDay = recent
            .GroupBy(d => d.Date)
            .Select(g => new StatPoint(g.Key, g.Count()))
            .OrderBy(p => p.Day)
            .ToList();

        var top = await db.Crackmes.AsNoTracking()
            .OrderByDescending(c => c.DownloadCount)
            .Take(5)
            .Select(c => new TopCrackme(c.Slug, c.Title, c.DownloadCount, c.Status))
            .ToListAsync(ct);

        return new ModerationStats(
            TotalCrackmes: byStatus.Sum(x => x.Count),
            PendingCrackmes: CountOf(CrackmeStatus.Pending),
            ApprovedCrackmes: CountOf(CrackmeStatus.Approved),
            RejectedCrackmes: CountOf(CrackmeStatus.Rejected),
            TakenDownCrackmes: CountOf(CrackmeStatus.TakenDown),
            PendingWriteups: await db.Solutions.AsNoTracking().CountAsync(s => s.Status == SolutionStatus.Pending, ct),
            OpenReports: await db.Reports.AsNoTracking().CountAsync(r => !r.IsResolved, ct),
            Users: await db.Users.AsNoTracking().CountAsync(ct),
            TotalDownloads: await db.Crackmes.AsNoTracking().SumAsync(c => c.DownloadCount, ct),
            TotalSolved: await db.Crackmes.AsNoTracking().SumAsync(c => c.SolvedCount, ct),
            SubmissionsLast7Days: await db.Crackmes.AsNoTracking().CountAsync(c => c.CreatedAt >= weekAgo, ct),
            SubmissionsLast30Days: await db.Crackmes.AsNoTracking().CountAsync(c => c.CreatedAt >= monthAgo, ct),
            SubmissionsByDay: byDay,
            TopDownloaded: top);
    }

    // Searchable list of every crackme (any status) so admins can take down / restore from the panel.
    [HttpGet("crackmes")]
    [Authorize(Policy = AuthSetup.AdminPolicy)]
    public async Task<IReadOnlyList<AdminCrackmeRow>> AdminCrackmes([FromQuery] string? q, [FromQuery] string? status, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var query = db.Crackmes.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(c => EF.Functions.ILike(c.Title, $"%{q}%") || EF.Functions.ILike(c.Slug, $"%{q}%"));
        if (Enum.TryParse<CrackmeStatus>(status, ignoreCase: true, out var st))
            query = query.Where(c => c.Status == st);

        return await query
            .OrderByDescending(c => c.CreatedAt)
            .Take(100)
            .Select(c => new AdminCrackmeRow(
                c.Id, c.Slug, c.Title, c.AnonymousHandle ?? AppConstants.AnonymousHandle,
                c.UploaderUserId == null ? null : db.Users.Where(u => u.Id == c.UploaderUserId).Select(u => u.Handle).FirstOrDefault(),
                c.Status, c.IsTakenDown, c.TakedownReason, c.DownloadCount, c.CreatedAt, c.PublishedAt))
            .ToListAsync(ct);
    }

    private async Task<IActionResult> ActAsync(Guid id, bool approve, string? message, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var c = await db.Crackmes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null)
            return NotFound();

        var now = DateTime.UtcNow;
        if (approve)
        {
            c.Status = CrackmeStatus.Approved;
            c.CurrentVerdict = ModerationVerdict.Approved;
            c.PublishedAt ??= now;
            c.PublicModeratorMessage = null;
        }
        else
        {
            c.Status = CrackmeStatus.Rejected;
            c.CurrentVerdict = ModerationVerdict.Disallowed;
            c.PublicModeratorMessage = message;
        }
        c.UpdatedAt = now;

        db.ModerationReviews.Add(new ModerationReview
        {
            Id = Guid.NewGuid(),
            TargetType = ModeratableType.Crackme,
            TargetId = c.Id,
            CrackmeId = c.Id,
            ReviewerId = Guid.Parse(User.FindFirstValue("uid")!),
            Verdict = approve ? ModerationVerdict.Approved : ModerationVerdict.Disallowed,
            PublicMessage = message,
            CreatedAt = now,
        });
        await db.SaveChangesAsync(ct);

        var actor = Guid.Parse(User.FindFirstValue("uid")!);
        try
        {
            if (approve)
                await Notifier.NotifyAsync(db, c.UploaderUserId, NotificationType.SubmissionApproved,
                    $"'{c.Title}' was approved", "It's live in the gallery now.", $"/challenge/{c.Slug}", actor, c.Id, ct);
            else
                await Notifier.NotifyAsync(db, c.UploaderUserId, NotificationType.SubmissionRejected,
                    $"'{c.Title}' wasn't approved", message, "/submissions", actor, c.Id, ct);
        }
        catch { /* a notify must never break the moderation action */ }

        if (approve && c.UploaderUserId is { } author)
        {
            try
            {
                var authored = await db.Crackmes.AsNoTracking()
                    .CountAsync(x => x.UploaderUserId == author && x.Status == CrackmeStatus.Approved && !x.IsTakenDown, ct);
                if (authored >= 3)
                    await BadgeService.TryAwardAsync(db, author, BadgeService.Scenarist, ct);
            }
            catch { }
        }
        return NoContent();
    }
}

using System.Security.Claims;
using BitMono.Web.Api.Auth;
using BitMono.Web.Api.Models;
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
        if (s.Status != SolutionStatus.Approved)
        {
            s.Status = SolutionStatus.Approved;
            s.UpdatedAt = DateTime.UtcNow;
            s.Crackme.SolvedCount++;
        }
        await db.SaveChangesAsync(ct);
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
        return NoContent();
    }
}

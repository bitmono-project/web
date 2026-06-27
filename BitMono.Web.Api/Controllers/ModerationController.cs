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
            c.Id, c.Slug, c.Title, c.Description, c.AnonymousHandle ?? "anonymous",
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

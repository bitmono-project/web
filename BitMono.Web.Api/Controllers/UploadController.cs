using System.Security.Claims;
using System.Security.Cryptography;
using BitMono.Web.Api.Helpers;
using BitMono.Web.Api.Models;
using BitMono.Web.Api.Security;
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
[Route("api/upload")]
[Authorize]
public sealed class UploadController(
    IServiceScopeFactory scopeFactory,
    BlobStorage storage,
    IMalwareScanner scanner,
    TurnstileVerifier turnstile,
    IConfiguration cfg,
    ILogger<UploadController> log) : ControllerBase
{
    [HttpPost]
    [EnableRateLimiting("upload")]
    public async Task<IActionResult> Submit([FromForm] UploadForm form, CancellationToken ct)
    {
        // Cloudflare Turnstile — Turnstile injects "cf-turnstile-response" into the form. No-op if unset.
        var captchaToken = Request.Form[TurnstileVerifier.FormField].ToString();
        if (!await turnstile.VerifyAsync(captchaToken, HttpContext.GetClientIp(), ct))
            return BadRequest("Captcha check failed — please try again.");

        var max = cfg.GetValue<long?>("Crackmes:MaxUploadBytes") ?? 10 * 1024 * 1024;
        var file = form.File;
        if (file is null || file.Length == 0 || file.Length > max)
            return BadRequest($"File must be between 1 byte and {max / (1024 * 1024)} MB.");
        if (!HasAllowedExtension(file.FileName))
            return BadRequest("Upload a single .dll / .exe, or a .zip (no password — we encrypt it).");
        if (string.IsNullOrWhiteSpace(form.Title))
            return BadRequest("A title is required.");
        if (!(form.AcceptOriginal && form.AcceptLegal && form.AcceptVm))
            return BadRequest("You must accept all three terms to submit.");

        await using var bufferStream = new MemoryStream();
        await file.CopyToAsync(bufferStream, ct);
        var bytes = bufferStream.ToArray();

        if (!LooksLikeAssemblyOrZip(bytes))
            return BadRequest("That file isn't a .NET assembly (MZ) or a zip (PK).");

        var sha = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

        // Advisory scan — a hit is a moderator signal, never an auto-reject.
        var scan = await scanner.ScanAsync(new MemoryStream(bytes, writable: false), ct);
        if (!scan.Clean)
            log.LogWarning("Upload {Sha} flagged by scanner: {Signal}", sha, scan.Signal);

        var id = Guid.NewGuid();
        var key = $"uploads/{id:N}/{SanitizeFileName(file.FileName)}";
        await storage.SaveAsync(key, new MemoryStream(bytes, writable: false), ct);

        var uid = Guid.Parse(User.FindFirstValue("uid")!);
        var handle = User.Identity?.Name ?? AppConstants.AnonymousHandle;
        var ip = HttpContext.GetClientIp();
        var now = DateTime.UtcNow;

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var terms = new TermsAcceptance
        {
            Id = Guid.NewGuid(),
            UserId = uid,
            TermsVersion = cfg["Crackmes:TermsVersion"] ?? "2026-06",
            AcceptedAt = now,
            Ip = ip,
            UserAgent = Truncate(Request.Headers.UserAgent.ToString(), 512),
        };

        var crackme = new Crackme
        {
            Id = id,
            Slug = await UniqueSlugAsync(db, Slug.From(form.Title), ct),
            Title = form.Title.Trim(),
            Description = form.Description,
            AuthorDifficulty = form.Difficulty,
            TargetPlatform = form.Platform,
            DotnetRuntime = form.Runtime,
            Language = form.Language,
            Preset = form.Preset,
            IsBitMonoObfuscated = form.IsBitMonoObfuscated,
            ReactionsEnabled = form.ReactionsEnabled,
            CommentReactionsEnabled = form.CommentReactionsEnabled,
            ProtectionsApplied = form.Protections.Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => new AppliedProtection { Name = p.Trim() }).ToList(),
            StorageKey = key,
            Sha256 = sha,
            SizeBytes = file.Length,
            OriginalFileName = SanitizeFileName(file.FileName),
            ContentType = file.ContentType,
            Status = CrackmeStatus.Pending,
            UploaderUserId = uid,
            AnonymousHandle = handle,
            UploaderIp = ip,
            TermsAcceptance = terms,
            TermsAcceptanceId = terms.Id,
            CreatedAt = now,
            UpdatedAt = now,
        };

        // Optional solve verification, set right at creation (the author can still change it later).
        if (form.VerificationKind != VerificationKind.None)
        {
            var verr = VerificationSetup.Apply(crackme, form.VerificationKind, form.VerificationAnswer?.Trim());
            if (verr is not null)
                return BadRequest(verr);
        }

        db.TermsAcceptances.Add(terms);
        db.Crackmes.Add(crackme);
        await db.SaveChangesAsync(ct);

        return Accepted(new UploadResponse(crackme.Id, crackme.Slug, "pending"));
    }

    private static async Task<string> UniqueSlugAsync(CrackmesDbContext db, string baseSlug, CancellationToken ct)
    {
        var slug = baseSlug;
        var n = 1;
        while (await db.Crackmes.AnyAsync(c => c.Slug == slug, ct))
            slug = $"{baseSlug}-{++n}";
        return slug;
    }

    private static bool HasAllowedExtension(string name) =>
        name.EndsWith(".dll", StringComparison.OrdinalIgnoreCase) ||
        name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ||
        name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase);

    private static bool LooksLikeAssemblyOrZip(byte[] bytes) =>
        bytes.Length >= 2 && ((bytes[0] == 0x4D && bytes[1] == 0x5A) || (bytes[0] == 0x50 && bytes[1] == 0x4B));

    private static string SanitizeFileName(string name)
    {
        var clean = Path.GetFileName(name);
        foreach (var c in Path.GetInvalidFileNameChars())
            clean = clean.Replace(c, '_');
        return string.IsNullOrWhiteSpace(clean) ? "upload.bin" : clean;
    }

    private static string? Truncate(string? s, int max) => s is null || s.Length <= max ? s : s[..max];
}

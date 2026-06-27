using BitMono.Web.Data;
using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.MigrationService.Seeding;

// Dev-only sample crackmes so the gallery isn't empty before real uploads exist.
// Invoked by EF Core's UseAsyncSeeding hook (runs on EnsureCreated/Migrate). No-op in prod
// and once any crackme exists. appdb is dropped + recreated each dev run, so it re-seeds cleanly.
public static class CrackmeSeed
{
    public static async Task SeedAsync(CrackmesDbContext db, IHostEnvironment environment, CancellationToken ct = default)
    {
        if (!environment.IsDevelopment())
            return;
        if (await db.Crackmes.AnyAsync(ct))
            return;

        var now = DateTime.UtcNow;
        AppliedProtection[] P(params string[] names) => names.Select(n => new AppliedProtection { Name = n }).ToArray();

        var samples = new[]
        {
            New("keygen-me-one", "Keygen Me One", "A friendly first keygen — find the serial algorithm.",
                "sunnamed", Difficulty.Easy, TargetPlatform.DotNet, ".NET 8", SourceLanguage.CSharp,
                ObfuscationPreset.Minimal, P("FullRenamer", "StringsEncryption"), 12_800, true, now.AddDays(-2),
                difSum: 8, difCnt: 4, qSum: 17, qCnt: 4, downloads: 240, solved: 6),
            New("license-bypass", "License Bypass", "Defeat the trial check. No patching — derive a valid key.",
                "ph4ntom", Difficulty.Medium, TargetPlatform.DotNet, ".NET Framework 4.8", SourceLanguage.CSharp,
                ObfuscationPreset.Balanced, P("FullRenamer", "NoNamespaces", "StringsEncryption", "AntiDe4dot", "DotNetHook"),
                70_700, true, now.AddDays(-5), difSum: 12, difCnt: 4, qSum: 18, qCnt: 4, downloads: 121, solved: 3),
            New("mono-serial", "Mono Serial", "Built for Mono — recover the serial without running it on .NET.",
                "deo", Difficulty.Hard, TargetPlatform.Mono, "Mono", SourceLanguage.CSharp,
                ObfuscationPreset.Custom, P("FullRenamer", "UnmanagedString"), 3_010, true, now.AddDays(-9),
                difSum: 16, difCnt: 4, qSum: 16, qCnt: 4, downloads: 88, solved: 1),
            New("unity-il2cpp-vault", "Unity IL2CPP Vault", "An IL2CPP build — the metadata is encrypted. Good luck.",
                "Desync", Difficulty.VeryHard, TargetPlatform.IL2CPP, "IL2CPP", SourceLanguage.Cpp,
                ObfuscationPreset.Maximum, P("FullRenamer", "StringsEncryption", "AntiDe4dot", "AntiILdasm", "DotNetHook"),
                1_520_000, true, now.AddDays(-12), difSum: 20, difCnt: 4, qSum: 24, qCnt: 4, downloads: 60, solved: 0),
            New("patchme-very-easy", "Patch Me (Very Easy)", "Plaintext serial — a warm-up for total beginners.",
                "SimbaHDD", Difficulty.VeryEasy, TargetPlatform.NetFramework, ".NET Framework 4.0", SourceLanguage.VbNet,
                ObfuscationPreset.Minimal, P("FullRenamer"), 4_500, true, now.AddDays(-15),
                difSum: 5, difCnt: 5, qSum: 15, qCnt: 5, downloads: 551, solved: 22),
            New("insane-vm", "Insane VM", "Custom virtualization on top of BitMono. For the brave.",
                "liboxin", Difficulty.Insane, TargetPlatform.DotNet, ".NET 9", SourceLanguage.CSharp,
                ObfuscationPreset.Maximum, P("FullRenamer", "NoNamespaces", "StringsEncryption", "CallToCalli", "BillionNops", "UnmanagedString"),
                142_000, true, now.AddDays(-20), difSum: 24, difCnt: 4, qSum: 22, qCnt: 4, downloads: 125, solved: 0),
        };

        db.Crackmes.AddRange(samples);
        await db.SaveChangesAsync(ct);

        static Crackme New(
            string slug, string title, string desc, string author, Difficulty difficulty,
            TargetPlatform platform, string runtime, SourceLanguage language, ObfuscationPreset preset,
            AppliedProtection[] protections, long size, bool isBitMono, DateTime published,
            int difSum, int difCnt, int qSum, int qCnt, long downloads, int solved) => new()
        {
            Id = Guid.NewGuid(),
            Slug = slug,
            Title = title,
            Description = desc,
            AnonymousHandle = author,
            AuthorDifficulty = difficulty,
            TargetPlatform = platform,
            DotnetRuntime = runtime,
            Language = language,
            Preset = preset,
            IsBitMonoObfuscated = isBitMono,
            ProtectionsApplied = protections.ToList(),
            StorageKey = $"seed/{slug}.zip",
            Sha256 = new string('0', 64),
            SizeBytes = size,
            OriginalFileName = $"{slug}.dll",
            ContentType = "application/octet-stream",
            DownloadCount = downloads,
            SolvedCount = solved,
            DifficultySum = difSum,
            DifficultyCount = difCnt,
            QualitySum = qSum,
            QualityCount = qCnt,
            Status = CrackmeStatus.Approved,
            CurrentVerdict = ModerationVerdict.Approved,
            CreatedAt = published,
            UpdatedAt = published,
            PublishedAt = published,
        };
    }
}

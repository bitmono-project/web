using BitMono.Web.Data;
using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.MigrationService.Seeding;

// The badge catalogue — seeded in ALL environments (it's reference data the award engine reads).
// Idempotent: adds any missing badges, leaves existing ones untouched.
public static class BadgeCatalog
{
    private static readonly Badge[] Catalogue =
    [
        new() { Code = "bitmonoed", Name = "Bitmonoed", Description = "Solved a crackme obfuscated with BitMono.", Rarity = BadgeRarity.Rare, SortOrder = 10 },
        new() { Code = "first_blood", Name = "First Blood", Description = "Were the first to solve a crackme.", Rarity = BadgeRarity.Epic, SortOrder = 20 },
        new() { Code = "scenarist", Name = "Scenarist", Description = "Published 3 approved crackmes.", Rarity = BadgeRarity.Rare, SortOrder = 30 },
        new() { Code = "professor", Name = "Professor", Description = "Had 3 writeups approved.", Rarity = BadgeRarity.Rare, SortOrder = 40 },
    ];

    public static async Task EnsureAsync(CrackmesDbContext db, CancellationToken ct = default)
    {
        var existing = await db.Badges.AsNoTracking().Select(b => b.Code).ToListAsync(ct);
        var missing = Catalogue.Where(b => !existing.Contains(b.Code)).ToList();
        if (missing.Count == 0)
            return;
        db.Badges.AddRange(missing);
        await db.SaveChangesAsync(ct);
    }
}

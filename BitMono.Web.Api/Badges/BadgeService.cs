using BitMono.Web.Api.Notifications;
using BitMono.Web.Data;
using BitMono.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Badges;

// Idempotent badge awarding: insert the ledger row if absent, then fire a BadgeAwarded
// notification. Callers wrap in try/catch so an award can never break the primary action.
public static class BadgeService
{
    public const string Bitmonoed = "bitmonoed";
    public const string FirstBlood = "first_blood";
    public const string Scenarist = "scenarist";
    public const string Professor = "professor";

    // Per-season podium badge, minted on the fly by SeasonAwarder (not in the seeded catalogue).
    public static string SeasonPodium(int season) => $"season_{season}_podium";

    public static async Task TryAwardAsync(CrackmesDbContext db, Guid userId, string code, CancellationToken ct)
    {
        if (await db.UserBadges.AsNoTracking().AnyAsync(b => b.UserId == userId && b.BadgeCode == code, ct))
            return;

        db.UserBadges.Add(new UserBadge { Id = Guid.NewGuid(), UserId = userId, BadgeCode = code, AwardedAt = DateTime.UtcNow });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return; // lost the race on the unique (UserId, BadgeCode) index
        }

        var badge = await db.Badges.AsNoTracking().FirstOrDefaultAsync(x => x.Code == code, ct);
        if (badge is null)
            return;
        var handle = await db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.Handle).FirstOrDefaultAsync(ct);
        await Notifier.NotifyAsync(db, userId, NotificationType.BadgeAwarded,
            $"Badge unlocked: {badge.Name}", badge.Description, handle is null ? null : $"/user/{handle}", null, null, ct);
    }
}

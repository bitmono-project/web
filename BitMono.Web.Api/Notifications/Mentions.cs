using System.Text.RegularExpressions;
using BitMono.Web.Data;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Notifications;

// @handle mentions in user text (comments, writeups, crackme descriptions). Parsing is shared with
// the frontend's MentionText — keep the pattern in sync (frontend/src/components/MentionText.tsx).
public static partial class Mentions
{
    // Handles are Slug.From output: lowercase alnum + inner dashes. The lookbehind keeps email-like
    // text (bob@gmail.com) from reading as a mention of @gmail.
    [GeneratedRegex(@"(?<![\w.@-])@([a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?)", RegexOptions.IgnoreCase)]
    private static partial Regex Pattern();

    private const int MaxPerBody = 5; // spam guard — the first few mentions notify, the rest are just text

    public static IReadOnlyList<string> Parse(string? text)
    {
        if (string.IsNullOrEmpty(text))
            return [];
        return Pattern().Matches(text)
            .Select(m => m.Groups[1].Value.ToLowerInvariant())
            .Distinct()
            .Take(MaxPerBody)
            .ToList();
    }

    // Notifies every real, non-banned user mentioned in `text`. `exclude` = users already notified
    // about this content some other way (e.g. the crackme owner); Notifier itself skips the actor.
    public static async Task NotifyAsync(
        CrackmesDbContext db, string? text, string actorName, Guid? actorId,
        string link, Guid? crackmeId, IReadOnlyCollection<Guid?> exclude, CancellationToken ct)
    {
        var handles = Parse(text);
        if (handles.Count == 0)
            return;

        var mentioned = await db.Users.AsNoTracking()
            .Where(u => u.Handle != null && handles.Contains(u.Handle) && !u.IsBanned)
            .Select(u => u.Id)
            .ToListAsync(ct);

        foreach (var uid in mentioned.Where(id => !exclude.Contains(id)))
            await Notifier.NotifyAsync(db, uid, NotificationType.Mentioned,
                $"{actorName} mentioned you", null, link, actorId, crackmeId, ct);
    }
}

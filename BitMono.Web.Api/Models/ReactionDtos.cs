namespace BitMono.Web.Api.Models;

public sealed record ReactionToggleRequest(string Emoji);

public sealed record ReactionSummary(IReadOnlyDictionary<string, int> Counts, IReadOnlyList<string> Mine);

// Owner-only toggles for a crackme.
public sealed record CrackmeSettingsRequest(bool ReactionsEnabled, bool CommentReactionsEnabled);

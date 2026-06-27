namespace BitMono.Web.Api.Models;

// Internal EF projection shapes so controllers don't lean on anonymous types.
public sealed record ReactionRow(string Emoji, Guid UserId);

public sealed record CommentReactionRow(Guid TargetId, string Emoji, Guid UserId);

public sealed record CommentRow(Guid Id, string? Author, string Body, bool IsSpoiler, DateTime CreatedAt);

public sealed record CrackmeReactionTarget(Guid Id, bool ReactionsEnabled);

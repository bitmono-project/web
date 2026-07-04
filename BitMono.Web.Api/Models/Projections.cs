namespace BitMono.Web.Api.Models;

// Internal EF projection shapes so controllers don't lean on anonymous types.
public sealed record ReactionRow(string Emoji, Guid UserId);

public sealed record CommentReactionRow(Guid TargetId, string Emoji, Guid UserId);

public sealed record CommentRow(Guid Id, Guid? ParentCommentId, string? Author, Guid? AuthorUserId, string Body, bool IsSpoiler, bool IsDeleted, bool IsHidden, DateTime CreatedAt, DateTime UpdatedAt);

public sealed record CrackmeReactionTarget(Guid Id, bool ReactionsEnabled);

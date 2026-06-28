using Microsoft.AspNetCore.Http;

namespace BitMono.Web.Api.Models;

public sealed record CommentItem(
    Guid Id, string Author, string? AuthorHandle, string Body, bool IsSpoiler, DateTime CreatedAt,
    IReadOnlyDictionary<string, int> Reactions, IReadOnlyList<string> MyReactions);

public sealed record CommentCreateRequest(string Body, bool IsSpoiler);

public sealed record RatingRequest(byte Difficulty, byte Quality);

// Averages after a vote (mirror the list/detail shape).
public sealed record RatingResult(double? AvgDifficulty, int DifficultyCount, double? AvgQuality, int QualityCount);

public sealed record MyRating(byte? Difficulty, byte? Quality);

// --- writeups (moderated solutions; each one IS a spoiler) ---

public sealed record WriteupItem(
    Guid Id, string Author, string? Title, string BodyMarkdown, bool HasAttachment, int ImageCount,
    int UpvoteCount, int HelpedCount, bool IsAuthorPick, bool MyUpvoted, bool MyHelped, bool CanMarkHelped, bool Mine, DateTime CreatedAt);

public sealed record WriteupVoteResult(int UpvoteCount, bool Upvoted);
public sealed record WriteupHelpedResult(int HelpedCount, bool Helped);

public sealed record WriteupForm
{
    public string? Title { get; set; }
    public string BodyMarkdown { get; set; } = "";
    public IFormFile? Attachment { get; set; }
    public List<IFormFile>? Images { get; set; }
}

public sealed record WriteupResponse(Guid Id, string Status);

// Moderation queue row for a pending writeup.
public sealed record PendingWriteup(
    Guid Id, string CrackmeSlug, string CrackmeTitle, string Author, string? Title,
    string BodyMarkdown, bool HasAttachment, int ImageCount, DateTime CreatedAt);

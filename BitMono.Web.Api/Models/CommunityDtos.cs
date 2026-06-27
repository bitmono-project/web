namespace BitMono.Web.Api.Models;

public sealed record CommentItem(Guid Id, string Author, string Body, bool IsSpoiler, DateTime CreatedAt);

public sealed record CommentCreateRequest(string Body, bool IsSpoiler);

public sealed record RatingRequest(byte Difficulty, byte Quality);

// Averages after a vote (mirror the list/detail shape).
public sealed record RatingResult(double? AvgDifficulty, int DifficultyCount, double? AvgQuality, int QualityCount);

public sealed record MyRating(byte? Difficulty, byte? Quality);

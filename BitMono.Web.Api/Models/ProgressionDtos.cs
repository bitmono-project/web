namespace BitMono.Web.Api.Models;

public sealed record LeaderboardEntry(
    int Rank,
    Guid UserId,
    string? Handle,
    string DisplayName,
    string? Avatar,
    int Points,
    int Solves,
    string RankName);

public sealed record LeaderboardResponse(IReadOnlyList<LeaderboardEntry> Items, int Total, int Page, int PageSize);

public sealed record MyRankResponse(
    int Points,
    int Solves,
    string RankName,
    string? NextRankName,
    int? PointsToNext,
    int? Position);

// Returned by the mark-solved / un-solve endpoints so the UI can update inline.
public sealed record SolveResult(bool Solved, int SolvedCount, bool FirstBlood, int PointsAwarded);

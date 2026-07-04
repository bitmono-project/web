namespace BitMono.Web.Api.Models;

// Leaderboard board selector. Bound case-insensitively from ?scope= (query strings are lower-case).
public enum LeaderboardScope { Overall, Monthly, DotNet, Season }

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

// The current season, for the leaderboard's season scope + countdown banner.
public sealed record SeasonMeta(int Number, string Name, DateTime StartsAt, DateTime EndsAt, int Current);

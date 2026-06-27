using BitMono.Web.Data;

namespace BitMono.Web.Api.Models;

public sealed record UserProfile(
    string Handle,
    string DisplayName,
    string? Avatar,
    string Role,
    DateTime JoinedAt,
    int Points,
    string RankName,
    int? Position,
    int Solves,
    int Authored,
    int Writeups,
    IReadOnlyList<ProfileBadge> Badges);

public sealed record ProfileBadge(string Code, string Name, string Description, BadgeRarity Rarity, DateTime AwardedAt);

public sealed record ProfileCrackme(
    string Slug,
    string Title,
    Difficulty Difficulty,
    long DownloadCount,
    int SolvedCount,
    DateTime PublishedAt);

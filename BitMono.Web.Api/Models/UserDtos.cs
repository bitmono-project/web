using BitMono.Web.Data;

namespace BitMono.Web.Api.Models;

public sealed record UserProfile(
    Guid Id,
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
    IReadOnlyList<ProfileBadge> Badges,
    // Bio is null for the public while hidden; the owner and staff still see it (plus the reason)
    // so it can be fixed / unhidden.
    string? Bio,
    bool BioHidden,
    string? BioHiddenReason);

public sealed record BioRequest(string? Bio);

public sealed record ProfileBadge(string Code, string Name, string Description, BadgeRarity Rarity, DateTime AwardedAt);

public sealed record ProfileCrackme(
    string Slug,
    string Title,
    Difficulty Difficulty,
    long DownloadCount,
    int SolvedCount,
    DateTime PublishedAt);

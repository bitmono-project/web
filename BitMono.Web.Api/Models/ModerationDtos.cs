using BitMono.Web.Data;

namespace BitMono.Web.Api.Models;

public sealed record PendingItem(
    Guid Id,
    string Slug,
    string Title,
    string? Description,
    string Author,
    TargetPlatform Platform,
    string? Runtime,
    SourceLanguage Language,
    Difficulty Difficulty,
    long SizeBytes,
    string Sha256,
    bool IsBitMonoObfuscated,
    IReadOnlyList<string> Protections,
    DateTime CreatedAt);

public sealed record ModerationActionRequest(string? Message);

// Taking a crackme down requires a reason — it's shown publicly on the tombstone and to the uploader.
public sealed record TakedownRequest(string Reason);

// Restoring is logged too; the optional reason shows in the public moderation history.
public sealed record RestoreRequest(string? Reason);

// Admin dashboard analytics. One round-trip; the frontend renders cards + a small chart/top-list.
public sealed record ModerationStats(
    int TotalCrackmes,
    int PendingCrackmes,
    int ApprovedCrackmes,
    int RejectedCrackmes,
    int TakenDownCrackmes,
    int PendingWriteups,
    int OpenReports,
    int Users,
    long TotalDownloads,
    int TotalSolved,
    int SubmissionsLast7Days,
    int SubmissionsLast30Days,
    IReadOnlyList<StatPoint> SubmissionsByDay,
    IReadOnlyList<TopCrackme> TopDownloaded);

public sealed record StatPoint(DateTime Day, int Count);
public sealed record TopCrackme(string Slug, string Title, long DownloadCount, CrackmeStatus Status);

// A row in the admin's crackme-management list — lets them find any crackme (any status) and act on it.
public sealed record AdminCrackmeRow(
    Guid Id,
    string Slug,
    string Title,
    string Author,
    string? AuthorHandle,
    CrackmeStatus Status,
    bool IsTakenDown,
    string? TakedownReason,
    long DownloadCount,
    DateTime CreatedAt,
    DateTime? PublishedAt);

// A row in the admin's user list — every registered account, newest first, searchable by name/handle/email.
public sealed record AdminUserRow(
    Guid Id,
    string DisplayName,
    string? Handle,
    string? AvatarUrl,
    string? Email,
    string Provider,
    UserRole Role,
    bool IsBanned,
    int Points,
    DateTime CreatedAt,
    DateTime LastLoginAt);

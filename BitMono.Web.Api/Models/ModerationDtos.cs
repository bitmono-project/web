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

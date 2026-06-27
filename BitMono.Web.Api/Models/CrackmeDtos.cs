using BitMono.Web.Data;

namespace BitMono.Web.Api.Models;

// Query string for the gallery list (bound from /api/crackmes?...). Plain class so the
// default model binder can populate it (positional records don't bind from query).
public sealed class CrackmeQuery
{
    public string? Q { get; set; }
    public TargetPlatform? Platform { get; set; }
    public int? MinDifficulty { get; set; }
    public int? MaxDifficulty { get; set; }
    public string? Protection { get; set; }
    public string? Sort { get; set; } // date (default) | downloads | difficulty
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 30;
}

public sealed record CrackmeListItem(
    string Slug,
    string Title,
    string Author,
    TargetPlatform Platform,
    string? Runtime,
    SourceLanguage Language,
    Difficulty AuthorDifficulty,
    double? AvgDifficulty,
    double? AvgQuality,
    long SizeBytes,
    long DownloadCount,
    int SolvedCount,
    int SolutionCount,
    int CommentCount,
    bool IsBitMonoObfuscated,
    IReadOnlyList<string> Protections,
    DateTime PublishedAt);

public sealed record CrackmeListResponse(IReadOnlyList<CrackmeListItem> Items, int Total, int Page, int PageSize);

public sealed record CrackmeDetail(
    string Slug,
    string Title,
    string? Description,
    string Author,
    TargetPlatform Platform,
    string? Runtime,
    SourceLanguage Language,
    Difficulty AuthorDifficulty,
    double? AvgDifficulty,
    int DifficultyCount,
    double? AvgQuality,
    int QualityCount,
    long SizeBytes,
    string? OriginalFileName,
    long DownloadCount,
    int SolvedCount,
    bool IsBitMonoObfuscated,
    ObfuscationPreset Preset,
    IReadOnlyList<string> Protections,
    DateTime PublishedAt);

using System.ComponentModel.DataAnnotations;

namespace BitMono.Web.Data.Entities;

// The challenge — aggregate root. Bytes live in R2 (StorageKey); only metadata here.
// User refs are nullable Guids for now (no User table until auth lands in Phase 1).
public class Crackme
{
    [Key] public Guid Id { get; set; }

    [Required, MaxLength(80)] public string Slug { get; set; } = null!;
    [Required, MaxLength(150)] public string Title { get; set; } = null!;
    [MaxLength(8000)] public string? Description { get; set; }

    public Difficulty AuthorDifficulty { get; set; }
    public TargetPlatform TargetPlatform { get; set; }
    [MaxLength(40)] public string? DotnetRuntime { get; set; }
    public SourceLanguage Language { get; set; }

    public ObfuscationPreset Preset { get; set; }
    public bool IsBitMonoObfuscated { get; set; }
    // Authoritative when obfuscated through BitMono; author-stated otherwise. Owned JSON.
    public List<AppliedProtection> ProtectionsApplied { get; set; } = [];

    // File metadata — bytes are in R2.
    [Required, MaxLength(512)] public string StorageKey { get; set; } = null!;
    [Required, MaxLength(64)] public string Sha256 { get; set; } = null!;
    public long SizeBytes { get; set; }
    [MaxLength(260)] public string? OriginalFileName { get; set; }
    [MaxLength(127)] public string? ContentType { get; set; }

    // Counters (update atomically, never read-modify-write).
    public long DownloadCount { get; set; }
    public int SolvedCount { get; set; }
    public int DifficultySum { get; set; }
    public int DifficultyCount { get; set; }
    public int QualitySum { get; set; }
    public int QualityCount { get; set; }

    // Lifecycle / moderation (cached latest; full history in ModerationReview).
    public CrackmeStatus Status { get; set; } = CrackmeStatus.Pending;
    public ModerationVerdict? CurrentVerdict { get; set; }
    [MaxLength(2000)] public string? PublicModeratorMessage { get; set; }
    public bool IsTakenDown { get; set; }
    public DateTime? TakenDownAt { get; set; }
    [MaxLength(1000)] public string? TakedownReason { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? PublishedAt { get; set; }

    // Uploader (nullable for anonymous).
    public Guid? UploaderUserId { get; set; }
    [MaxLength(50)] public string? AnonymousHandle { get; set; }
    [MaxLength(45)] public string? UploaderIp { get; set; }
    public Guid? TermsAcceptanceId { get; set; }
    public TermsAcceptance? TermsAcceptance { get; set; }

    public ICollection<CrackmeTag> Tags { get; set; } = [];
    public ICollection<Solution> Solutions { get; set; } = [];
    public ICollection<Comment> Comments { get; set; } = [];
    public ICollection<Rating> Ratings { get; set; } = [];
    public ICollection<ModerationReview> Reviews { get; set; } = [];
}

// Owned type (serialized as JSON on Crackme). Free-form so non-BitMono entries are allowed.
public class AppliedProtection
{
    [MaxLength(60)] public string Name { get; set; } = null!;
    public bool Enabled { get; set; } = true;
}

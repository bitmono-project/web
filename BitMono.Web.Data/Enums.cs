namespace BitMono.Web.Data;

// pending → approved/rejected → taken-down (soft). Draft only if save-before-submit lands.
public enum CrackmeStatus { Draft, Pending, Approved, Rejected, TakenDown }

public enum TargetPlatform { DotNet, Mono, NetFramework, Unity, IL2CPP, Native, Other }

public enum SourceLanguage { CSharp, FSharp, VbNet, Cpp, Other }

// 1–6, crackmes.one scale (Very Easy → Insane). Author claims one; community averages refine it.
public enum Difficulty { VeryEasy = 1, Easy, Medium, Hard, VeryHard, Insane }

public enum SolutionStatus { Pending, Approved, Rejected, Hidden, Deleted }

// Per-user signal on a writeup. Append-only — stored as int.
public enum SolutionVoteKind { Upvote, HelpedSolve }

// Mirrors Safeturned's AdminVerdict shape, retuned for the gallery lifecycle.
// Append-only (stored as int) — Restored marks an undo of a takedown, distinct from a first-time Approved.
public enum ModerationVerdict { None, Approved, Suspicious, Malware, Disallowed, Spam, FalsePositive, TakenDown, Restored }

// Kind of entry in the public moderation history. Serialized camelCase ("takenDown"/"restored").
public enum ModerationEventAction { TakenDown, Restored }

// Lets one review/report table cover all user content. Append-only — stored as int.
public enum ModeratableType { Crackme, Solution, Comment, UserProfile }

public enum ReportReason { Malware, Spam, Stolen, Broken, Inappropriate, Other }

// ObfuscationPreset mirrors BitMono.Shared.Models exactly — do not re-number.
public enum ObfuscationPreset { Custom, Minimal, Balanced, Maximum }

public enum UserRole { User, Moderator, Admin }

// How a solve was recorded. SelfReported = honor "I solved it"; Writeup = an approved writeup;
// Verified = passed flag/keygen verification (the oracle seam). Append-only — stored as int.
public enum SolveSource { SelfReported, Writeup, Verified }

// In-app notification kinds. Append-only — stored as int.
public enum NotificationType
{
    SubmissionApproved, SubmissionRejected, TakenDown,
    CommentOnYourCrackme, WriteupOnYourCrackme,
    SolvedYourCrackme, FirstBlood, BadgeAwarded,
    Mentioned, ProfileBioHidden,
}

// Badge tiers, for the rarity tint on the shelf. Append-only — stored as int.
public enum BadgeRarity { Common, Rare, Epic, Legendary }

// How a crackme's solve is verified. None = honor "I solved it"; the others check a submitted
// answer server-side (no code execution). Append-only — stored as int.
public enum VerificationKind { None, ExactCaseInsensitive, ExactCaseSensitive, Regex }

// VirusTotal scan lifecycle for a release asset. pending → done; skipped means the file is over VT's
// 32 MB upload cap so it can't be submitted. Append-only — stored as int; serialized camelCase.
public enum ScanStatus { Pending, Done, Skipped }

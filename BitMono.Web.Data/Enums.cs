namespace BitMono.Web.Data;

// pending → approved/rejected → taken-down (soft). Draft only if save-before-submit lands.
public enum CrackmeStatus { Draft, Pending, Approved, Rejected, TakenDown }

public enum TargetPlatform { DotNet, Mono, NetFramework, Unity, IL2CPP, Native, Other }

public enum SourceLanguage { CSharp, FSharp, VbNet, Cpp, Other }

// 1–6, crackmes.one scale (Very Easy → Insane). Author claims one; community averages refine it.
public enum Difficulty { VeryEasy = 1, Easy, Medium, Hard, VeryHard, Insane }

public enum SolutionStatus { Pending, Approved, Rejected, Hidden }

// Mirrors Safeturned's AdminVerdict shape, retuned for the gallery lifecycle.
public enum ModerationVerdict { None, Approved, Suspicious, Malware, Disallowed, Spam, FalsePositive, TakenDown }

// Lets one review/report table cover all user content.
public enum ModeratableType { Crackme, Solution, Comment }

public enum ReportReason { Malware, Spam, Stolen, Broken, Inappropriate, Other }

// ObfuscationPreset mirrors BitMono.Shared.Models exactly — do not re-number.
public enum ObfuscationPreset { Custom, Minimal, Balanced, Maximum }

namespace BitMono.Web.Api.Models;

// Author sets the answer. Kind is the VerificationKind name; Answer is the serial/token (Exact*)
// or the regex pattern (Regex); ignored for None.
public sealed record VerificationRequest(string Kind, string? Answer);

// A solver's attempt at the answer.
public sealed record FlagSubmitRequest(string Answer);

// Result of an attempt. Correct=false means a wrong answer (still a 200); the rest mirror SolveResult.
public sealed record FlagResult(bool Correct, int SolvedCount, bool IsFirstBlood, int PointsAwarded);

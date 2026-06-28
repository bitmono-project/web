using System.Text.RegularExpressions;
using BitMono.Web.Data;
using BitMono.Web.Data.Entities;

namespace BitMono.Web.Api.Verification;

// Applies a solve-verification config to a crackme — shared by upload-time setup and the owner's later edit.
// Returns null on success, or a user-facing error for an invalid regex / missing answer.
public static class VerificationSetup
{
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromMilliseconds(100);

    public static string? Apply(Crackme c, VerificationKind kind, string? answer)
    {
        switch (kind)
        {
            case VerificationKind.None:
                c.VerificationHash = c.VerificationSalt = c.VerificationPattern = null;
                break;
            case VerificationKind.Regex:
                if (string.IsNullOrEmpty(answer))
                    return "A regex pattern is required.";
                try { _ = new Regex(answer, RegexOptions.None, RegexTimeout); }
                catch (ArgumentException) { return "That isn't a valid regular expression."; }
                c.VerificationPattern = answer;
                c.VerificationHash = c.VerificationSalt = null;
                break;
            default: // ExactCaseInsensitive / ExactCaseSensitive
                if (string.IsNullOrEmpty(answer))
                    return "An answer is required.";
                var normalized = kind == VerificationKind.ExactCaseInsensitive ? answer.ToLowerInvariant() : answer;
                (c.VerificationHash, c.VerificationSalt) = VerificationHasher.Hash(normalized);
                c.VerificationPattern = null;
                break;
        }
        c.VerificationKind = kind;
        return null;
    }
}

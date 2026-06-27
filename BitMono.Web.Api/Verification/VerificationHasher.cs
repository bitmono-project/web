using System.Security.Cryptography;

namespace BitMono.Web.Api.Verification;

// Answers are stored PBKDF2-hashed + salted so a DB/backup read can't reveal them, and brute force
// (already rate-limited at the endpoint) stays slow.
public static class VerificationHasher
{
    private const int Iterations = 100_000;

    public static (string Hash, string Salt) Hash(string answer)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(answer, salt, Iterations, HashAlgorithmName.SHA256, 32);
        return (Convert.ToBase64String(hash), Convert.ToBase64String(salt));
    }

    public static bool Verify(string answer, string hash, string salt)
    {
        var saltBytes = Convert.FromBase64String(salt);
        var computed = Rfc2898DeriveBytes.Pbkdf2(answer, saltBytes, Iterations, HashAlgorithmName.SHA256, 32);
        return CryptographicOperations.FixedTimeEquals(computed, Convert.FromBase64String(hash));
    }
}

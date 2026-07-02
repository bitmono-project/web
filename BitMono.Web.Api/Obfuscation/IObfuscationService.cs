using BitMono.Web.Api.Models;

namespace BitMono.Web.Api.Obfuscation;

public interface IObfuscationService
{
    Task<byte[]> ObfuscateAsync(
        string fileName,
        byte[] input,
        IReadOnlyList<string> protections,
        IReadOnlyList<byte[]> dependencies,
        byte[]? signingKey,
        CancellationToken ct);

    // The engine's current BitMono version — stamped onto a crackme at publish so the matrix knows
    // which build produced it. Publish-time is accurate enough (the engine only rolls on a Watchtower
    // pull every ~5 min, and publish follows obfuscation within that window).
    Task<VersionResponse> GetVersionAsync(CancellationToken ct);
}

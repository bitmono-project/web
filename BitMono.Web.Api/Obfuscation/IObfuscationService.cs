namespace BitMono.Web.Api.Obfuscation;

public interface IObfuscationService
{
    Task<byte[]> ObfuscateAsync(string fileName, byte[] input, IReadOnlyList<string> protections, CancellationToken ct);
}

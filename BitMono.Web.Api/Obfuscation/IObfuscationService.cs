namespace BitMono.Web.Api.Obfuscation;

public interface IObfuscationService
{
    Task<byte[]> ObfuscateAsync(string fileName, byte[] input, CancellationToken ct);
}

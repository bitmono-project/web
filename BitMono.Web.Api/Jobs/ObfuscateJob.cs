using BitMono.Web.Api.Obfuscation;
using BitMono.Web.Api.Storage;
using Hangfire;

namespace BitMono.Web.Api.Jobs;

public sealed class ObfuscateJob(IObfuscationService obfuscator, FileStore store, ILogger<ObfuscateJob> logger)
{
    // Obfuscation failures are deterministic, so don't retry.
    [AutomaticRetry(Attempts = 0)]
    public async Task RunAsync(Guid id, string fileName, CancellationToken ct)
    {
        try
        {
            var input = await store.ReadInputAsync(id, ct);
            var output = await obfuscator.ObfuscateAsync(fileName, input, ct);
            await store.SaveOutputAsync(id, output, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Obfuscation {Id} failed", id);
            store.MarkFailed(id);
            throw;
        }
        finally
        {
            store.DeleteInput(id);
        }
    }
}

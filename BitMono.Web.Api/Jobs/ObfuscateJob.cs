using BitMono.Web.Api.Obfuscation;
using BitMono.Web.Api.Storage;
using Hangfire;

namespace BitMono.Web.Api.Jobs;

public sealed class ObfuscateJob(IObfuscationService obfuscator, FileStore store, ILogger<ObfuscateJob> logger)
{
    // Obfuscation failures are deterministic, so don't retry.
    // Dependencies and the optional signing key were uploaded as their own inputs (each its own id);
    // we read them here and wipe every input — target, deps, key — in the finally.
    [AutomaticRetry(Attempts = 0)]
    public async Task RunAsync(Guid id, string fileName, string[] protections, Guid[] dependencyIds, Guid? signingKeyId, bool preview, CancellationToken ct)
    {
        try
        {
            var input = await store.ReadInputAsync(id, ct);

            var dependencies = new List<byte[]>(dependencyIds.Length);
            foreach (var dependencyId in dependencyIds)
                dependencies.Add(await store.ReadInputAsync(dependencyId, ct));

            var signingKey = signingKeyId is { } keyId ? await store.ReadInputAsync(keyId, ct) : null;

            var output = await obfuscator.ObfuscateAsync(fileName, input, protections, dependencies, signingKey, ct);
            await store.SaveOutputAsync(id, output, ct);

            // Opt-in only: decompile a sample of input + output here, the one moment both bytes exist
            // (the input is wiped in the finally). Never fails the job — a broken preview is cosmetic.
            if (preview)
            {
                try
                {
                    var json = DecompilerPreviewer.AnalyzeToJson(input, output, protections);
                    await store.SavePreviewAsync(id, json, ct);
                }
                catch (Exception ex) { logger.LogWarning(ex, "Decompiler preview {Id} failed", id); }
            }
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
            foreach (var dependencyId in dependencyIds)
                store.DeleteInput(dependencyId);
            if (signingKeyId is { } keyId)
                store.DeleteInput(keyId);
        }
    }
}

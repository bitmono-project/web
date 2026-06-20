using BitMono.Web.Api.Storage;

namespace BitMono.Web.Api.Jobs;

public sealed class CleanupJob(FileStore store, ILogger<CleanupJob> logger)
{
    public Task RunAsync(CancellationToken ct)
    {
        var removed = store.SweepOlderThan(TimeSpan.FromHours(1));
        if (removed > 0)
            logger.LogInformation("Cleanup removed {Count} stale files", removed);
        return Task.CompletedTask;
    }
}

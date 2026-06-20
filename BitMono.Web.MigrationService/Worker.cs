using System.Diagnostics;
using BitMono.Web.Data;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.MigrationService;

// Runs once at startup, then stops the host (one-shot). The API gates on its completion.
public class Worker(
    IServiceProvider serviceProvider,
    IHostApplicationLifetime lifetime,
    IHostEnvironment environment,
    ILogger<Worker> logger) : BackgroundService
{
    public const string ActivitySourceName = "Migrations";
    private static readonly ActivitySource ActivitySource = new(ActivitySourceName);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var activity = ActivitySource.StartActivity("Migrating appdb", ActivityKind.Client);
        try
        {
            await using var scope = serviceProvider.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

            if (environment.IsDevelopment())
            {
                // Dev convenience: rebuild appdb from the current model, no migration needed.
                // appdb is EF-only (Hangfire keeps its own `db`), so this never touches Hangfire.
                logger.LogWarning("Development: dropping + recreating appdb from the current model.");
                await db.Database.EnsureDeletedAsync(ct);
                await db.Database.EnsureCreatedAsync(ct);
            }
            else
            {
                await db.Database.MigrateAsync(ct);
            }

            logger.LogInformation("appdb is up to date.");
        }
        catch (Exception ex)
        {
            activity?.AddException(ex);
            throw;
        }

        lifetime.StopApplication();
    }
}

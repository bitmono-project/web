using System.Diagnostics;
using BitMono.Web.Data;
using BitMono.Web.MigrationService.Seeding;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace BitMono.Web.MigrationService;

// Runs once at startup, then stops the host (one-shot). The API gates on its completion.
public class Worker(
    IServiceProvider serviceProvider,
    IHostApplicationLifetime lifetime,
    IHostEnvironment environment,
    IConfiguration configuration,
    ILogger<Worker> logger) : BackgroundService
{
    public const string ActivitySourceName = "Migrations";
    private static readonly ActivitySource ActivitySource = new(ActivitySourceName);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var activity = ActivitySource.StartActivity("Migrating databases", ActivityKind.Client);
        try
        {
            var dbConnectionString = configuration.GetConnectionString("db")
                ?? throw new InvalidOperationException("Connection string 'db' not found.");
            var appdbConnectionString = configuration.GetConnectionString("appdb")
                ?? throw new InvalidOperationException("Connection string 'appdb' not found.");

            await PostgresDatabaseBootstrap.EnsureExistsAsync(dbConnectionString, logger, ct);
            await PostgresDatabaseBootstrap.EnsureExistsAsync(appdbConnectionString, logger, ct);

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

            // Badge catalogue (all envs — reference data), then dev-only sample crackmes.
            await BadgeCatalog.EnsureAsync(db, ct);
            await CrackmeSeed.SeedAsync(db, environment, ct);

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

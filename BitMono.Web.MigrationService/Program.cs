using BitMono.Web.Data;
using BitMono.Web.MigrationService;
using Microsoft.EntityFrameworkCore;

var builder = Host.CreateApplicationBuilder(args);

builder.AddServiceDefaults();
builder.AddSentry();

// Register the DbContext ourselves (so we can set MigrationsAssembly), then Enrich for Aspire
// health/retry/telemetry — the documented pattern for a custom-configured Aspire DbContext.
var connectionString = builder.Configuration.GetConnectionString("appdb")
    ?? throw new InvalidOperationException("Connection string 'appdb' not found.");
builder.Services.AddDbContext<CrackmesDbContext>(options =>
    options.UseNpgsql(connectionString, npgsql => npgsql.MigrationsAssembly("BitMono.Web.MigrationService")));
builder.EnrichNpgsqlDbContext<CrackmesDbContext>();

builder.Services.AddHostedService<Worker>();

builder.Build().Run();

using BitMono.Web.Api.Helpers;
using BitMono.Web.Api.Jobs;
using BitMono.Web.Api.Obfuscation;
using BitMono.Web.Api.Storage;
using Hangfire;
using Hangfire.PostgreSql;
using Npgsql;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddSentry();
builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

builder.AddNpgsqlDataSource(connectionName: "db");

builder.Services.AddHangfire((sp, config) => config
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UsePostgreSqlStorage(o => o.UseNpgsqlConnection(
        sp.GetRequiredService<NpgsqlDataSource>().ConnectionString)));
builder.Services.AddHangfireServer();

builder.Services.AddSingleton<FileStore>();
builder.Services.AddScoped<IObfuscationService, BitMonoObfuscationService>();
builder.Services.AddScoped<ObfuscateJob>();
builder.Services.AddScoped<CleanupJob>();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("obfuscate", http =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: http.GetClientIp(),
            factory: _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
});

var app = builder.Build();

app.UseExceptionHandler();

app.MapDefaultEndpoints();
if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseHttpsRedirection();
app.UseRateLimiter();

// Lock /hangfire behind Cloudflare Access before exposing publicly.
app.UseHangfireDashboard("/hangfire");

app.MapControllers();

RecurringJob.AddOrUpdate<CleanupJob>("cleanup", j => j.RunAsync(CancellationToken.None), Cron.Hourly);

app.Run();

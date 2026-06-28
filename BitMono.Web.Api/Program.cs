using BitMono.Web.Api.Hangfire;
using BitMono.Web.Api.Helpers;
using BitMono.Web.Api.Jobs;
using BitMono.Web.Api.Auth;
using BitMono.Web.Api.Obfuscation;
using BitMono.Web.Api.Security;
using BitMono.Web.Api.Storage;
using BitMono.Web.Data;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.HttpOverrides;
using Npgsql;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddSentry();

// Behind Cloudflare Tunnel TLS terminates at the edge and the api is reached over http on a private
// Docker network. Honor X-Forwarded-Proto/Host so OAuth builds https redirect_uris (else mismatch).
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    options.KnownIPNetworks.Clear();   // .NET 10 renamed KnownNetworks → KnownIPNetworks
    options.KnownProxies.Clear();
});
builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

builder.AddNpgsqlDataSource(connectionName: "db");

// Crackmes gallery schema lives on the separate appdb (Hangfire keeps `db`).
builder.AddNpgsqlDbContext<CrackmesDbContext>("appdb");

builder.AddBitMonoAuth();
builder.AddBlobStorage();

builder.Services.AddHttpClient("turnstile");
builder.Services.AddScoped<TurnstileVerifier>();

builder.Services.AddHangfire((sp, config) => config
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UsePostgreSqlStorage(o => o.UseConnectionFactory(
        new NpgsqlDataSourceConnectionFactory(sp.GetRequiredService<NpgsqlDataSource>()))));
// Cap concurrent obfuscations to one Hangfire worker per engine replica (the AppHost injects the count to
// keep them in lockstep). BitMono is ~1 core/job, so dispatching more than there are replicas just thrashes.
builder.Services.AddHangfireServer(options =>
    options.WorkerCount = builder.Configuration.GetValue<int?>("Obfuscation:WorkerCount") ?? Environment.ProcessorCount);

builder.Services.AddSingleton<FileStore>();
builder.Services.AddScoped<ObfuscateJob>();
builder.Services.AddScoped<CleanupJob>();

var obfuscationUrl = builder.Configuration["Obfuscation:Url"] ?? "http://localhost:8743";
#pragma warning disable EXTEXP0001
builder.Services.AddHttpClient("obfuscation", client =>
{
    client.BaseAddress = new Uri(obfuscationUrl);
    client.Timeout = TimeSpan.FromMinutes(5);
}).RemoveAllResilienceHandlers();
#pragma warning restore EXTEXP0001
builder.Services.AddScoped<IObfuscationService, RemoteObfuscationService>();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("obfuscate", http =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: http.GetClientIp(),
            factory: _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
    options.AddPolicy("upload", http =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: http.GetClientIp(),
            factory: _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));
    options.AddPolicy("comment", http =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: http.GetClientIp(),
            factory: _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1) }));
});

var app = builder.Build();

app.UseForwardedHeaders();   // first — sets Request.Scheme=https from X-Forwarded-Proto for correct OAuth redirects

app.UseExceptionHandler();

app.MapDefaultEndpoints();
if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseRateLimiter();
app.UseHangfireDashboard("/hangfire");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Lifetime.ApplicationStarted.Register(() =>
    RecurringJob.AddOrUpdate<CleanupJob>("cleanup", j => j.RunAsync(CancellationToken.None), Cron.Hourly));

app.Run();

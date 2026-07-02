using BitMono.Web.Api.Hangfire;
using BitMono.Web.Api.Helpers;
using BitMono.Web.Api.Jobs;
using BitMono.Web.Api.Auth;
using BitMono.Web.Api.Obfuscation;
using BitMono.Web.Api.ReleaseFeed;
using BitMono.Web.Api.Security;
using BitMono.Web.Api.Storage;
using BitMono.Web.Data;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.HttpOverrides;
using Npgsql;
using System.Net.Http.Headers;
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

// Release download chooser + VirusTotal scanning, both hitting external third-party APIs. The standard
// resilience handler is removed (like the obfuscation client) so large release assets (~34 MB) can stream
// through /download without its 30s total timeout, and so VirusTotal retries don't burn the 4/min quota.
builder.Services.AddMemoryCache();
#pragma warning disable EXTEXP0001
builder.Services.AddHttpClient("github", client =>
{
    client.BaseAddress = new Uri("https://api.github.com/");
    client.DefaultRequestHeaders.UserAgent.ParseAdd("BitMono-Web");
    client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
    // Unauthenticated GitHub API is 60 req/hr per IP — exhausted on a shared datacenter IP (prod hit a 403
    // "rate limit exceeded"). A token (even scopeless, for public data) raises it to 5,000/hr.
    var token = builder.Configuration["GitHub:ApiToken"];
    if (!string.IsNullOrWhiteSpace(token))
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    client.Timeout = TimeSpan.FromMinutes(5);
}).RemoveAllResilienceHandlers();

var virusTotalKey = builder.Configuration["VirusTotal:ApiKey"];
builder.Services.AddHttpClient("virustotal", client =>
{
    client.BaseAddress = new Uri("https://www.virustotal.com/api/v3/");
    if (!string.IsNullOrWhiteSpace(virusTotalKey))
        client.DefaultRequestHeaders.Add("x-apikey", virusTotalKey);
    client.Timeout = TimeSpan.FromSeconds(30);
}).RemoveAllResilienceHandlers();
#pragma warning restore EXTEXP0001
builder.Services.AddSingleton<ReleaseCatalog>();
builder.Services.AddScoped<VirusTotalScanner>();

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
    // /download proxies real bytes through us — cap per-IP so it can't be turned into a bandwidth pump.
    options.AddPolicy("download", http =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: http.GetClientIp(),
            factory: _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1) }));
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
{
    RecurringJob.AddOrUpdate<CleanupJob>("cleanup", j => j.RunAsync(CancellationToken.None), Cron.Hourly);
    // Work through the release's assets a few at a time (free VT API = 4 lookups/min). No-ops without a key.
    RecurringJob.AddOrUpdate<VirusTotalScanner>("vtscan", s => s.RunAsync(CancellationToken.None), "*/2 * * * *");
});

app.Run();

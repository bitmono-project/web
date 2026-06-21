using BitMono.Web.Api.Helpers;
using BitMono.Web.Api.Jobs;
using BitMono.Web.Api.Obfuscation;
using BitMono.Web.Api.Storage;
using Hangfire;
using Hangfire.PostgreSql;
using Npgsql;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddSentry();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

builder.AddNpgsqlDataSource(connectionName: "db");

// Hangfire has no Aspire client integration, so it needs the raw connection string.
// NpgsqlDataSource redacts the password from its ConnectionString, which left Hangfire
// connecting password-less (SASL/SCRAM failure) — so read the string Aspire injects.
var dbConnectionString = builder.Configuration.GetConnectionString("db");
builder.Services.AddHangfire(config => config
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UsePostgreSqlStorage(o => o.UseNpgsqlConnection(dbConnectionString)));
builder.Services.AddHangfireServer();

builder.Services.AddSingleton<FileStore>();
builder.Services.AddScoped<ObfuscateJob>();
builder.Services.AddScoped<CleanupJob>();

// Obfuscation runs in the separate obfuscation-service; the API reaches it over HTTP (URL injected
// by Aspire as Obfuscation:Url). RemoveAllResilienceHandlers opts this client out of the 30s
// standard-resilience cap — obfuscation can take minutes.
var obfuscationUrl = builder.Configuration["Obfuscation:Url"] ?? "http://localhost:8743";
#pragma warning disable EXTEXP0001 // RemoveAllResilienceHandlers is the supported way to opt out of the 30s default cap
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
});

var app = builder.Build();

app.UseExceptionHandler();

// Serve the built SPA (copied into wwwroot at publish by PublishWithContainerFiles). API routes win;
// anything else falls back to index.html for client-side routing.
app.UseStaticFiles();

app.MapDefaultEndpoints();
if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseRateLimiter();

// Lock /hangfire behind Cloudflare Access before exposing publicly.
app.UseHangfireDashboard("/hangfire");

app.MapControllers();
app.MapFallbackToFile("index.html");

// Register after the app is serving — AddOrUpdate hits Postgres and must not block startup.
app.Lifetime.ApplicationStarted.Register(() =>
    RecurringJob.AddOrUpdate<CleanupJob>("cleanup", j => j.RunAsync(CancellationToken.None), Cron.Hourly));

app.Run();

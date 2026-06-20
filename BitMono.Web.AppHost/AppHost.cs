var builder = DistributedApplication.CreateBuilder(args);

var runMode = builder.ExecutionContext.IsRunMode;

// Docker Compose generation + SSH-deploy pipeline.
// Aspire.Hosting.Docker.SshDeploy is our own package (see Safeturned/aspire-ssh-deploy, feedz.io feed).
builder.AddDockerComposeEnvironment("bitmono")
    .WithSshDeploySupport();

var postgres = builder.AddPostgres("postgres")
    .WithDataVolume()
    .WithLifetime(ContainerLifetime.Persistent);
if (!runMode)
{
    postgres.WithPassword(builder.AddParameter("DatabasePassword", secret: true));
}
var db = postgres.AddDatabase("db");
var appdb = postgres.AddDatabase("appdb"); // EF Core schema (crackmes); Hangfire keeps `db`

var redis = builder.AddRedis("redis")
    .WithDataVolume()
    .WithLifetime(ContainerLifetime.Persistent);
if (!runMode)
{
    redis.WithPassword(builder.AddParameter("RedisPassword", secret: true));
}

// Obfuscation engine — its own repo/image (bitmono-project/obfuscation-service), built + rolled
// independently. Run-mode: build from the local sibling source if present (like Safeturned's
// FileChecker); otherwise pull the published image. Internal-only — the API reaches it over HTTP.
var obfuscationPath = Path.GetFullPath(Path.Combine(builder.AppHostDirectory, "..", "..", "obfuscation-service"));
var obfuscation = runMode && Directory.Exists(obfuscationPath)
    ? builder.AddDockerfile("obfuscation", obfuscationPath, "Dockerfile").WithHttpEndpoint(targetPort: 8080, name: "http")
    : builder.AddContainer("obfuscation", "ghcr.io/bitmono-project/obfuscation-service:latest").WithHttpEndpoint(targetPort: 8080, name: "http");
// Containers don't reload config at runtime; disabling the file watcher avoids the host's inotify
// instance limit (the deploy server hit fs.inotify.max_user_instances=128 → startup IOException).
obfuscation.WithEnvironment("DOTNET_hostBuilder__reloadConfigOnChange", "false");

// Runs EF migrations (prod) / recreates the dev schema on `appdb`, then exits; the API waits for it.
var migrations = builder.AddProject<Projects.BitMono_Web_MigrationService>("migrations")
    .WithReference(appdb)
    .WithEnvironment("DOTNET_hostBuilder__reloadConfigOnChange", "false")
    .WaitFor(appdb);

var api = builder.AddProject<Projects.BitMono_Web_Api>("api", launchProfileName: "http")
    .WithReference(db)
    .WithReference(redis)
    .WithReference(appdb)
    .WithEnvironment("Obfuscation__Url", obfuscation.GetEndpoint("http"))
    .WithEnvironment("DOTNET_hostBuilder__reloadConfigOnChange", "false")
    .WaitFor(db)
    .WaitFor(redis)
    .WaitFor(obfuscation)
    .WaitForCompletion(migrations);

// The Vite frontend, orchestrated by Aspire (npm install + `npm run dev`). AddViteApp already
// registers the http endpoint + PORT, so don't add WithHttpEndpoint. Run-mode only — production
// serving (static/CDN) is a separate deploy concern. See aspire.dev "Deploy JavaScript apps".
if (runMode)
{
    builder.AddViteApp("frontend", "../frontend")
        .WithReference(api)
        .WithEnvironment("VITE_API_URL", api.GetEndpoint("http"))
        .WaitFor(api)
        .WithExternalHttpEndpoints();
}

builder.Build().Run();

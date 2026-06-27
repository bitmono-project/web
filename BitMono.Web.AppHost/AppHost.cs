#pragma warning disable ASPIREPIPELINES003

var builder = DistributedApplication.CreateBuilder(args);

const int WebDeployPort = 8429;
const int ApiDeployPort = 8430;
const int ObfuscationPort = 8743;

var config = builder.Configuration;
var runMode = builder.ExecutionContext.IsRunMode;
var imageTag = config["IMAGE_TAG_SUFFIX"] ?? "dev";

builder.AddDockerComposeEnvironment("bitmono")
    .WithSshDeploySupport();

var postgres = builder.AddPostgres("postgres")
    .WithDataVolume()
    .WithLifetime(ContainerLifetime.Persistent);
if (!runMode)
{
    postgres.WithPassword(builder.AddParameter("DatabasePassword", secret: true))
        .PublishAsDockerComposeService((_, service) => service.Restart = "always");
}
var db = postgres.AddDatabase("db");
var appdb = postgres.AddDatabase("appdb");

var redis = builder.AddRedis("redis")
    .WithDataVolume()
    .WithLifetime(ContainerLifetime.Persistent);
if (!runMode)
{
    redis.WithPassword(builder.AddParameter("RedisPassword", secret: true))
        .PublishAsDockerComposeService((_, service) => service.Restart = "always");
}

var obfuscationPath = Path.GetFullPath(Path.Combine(builder.AppHostDirectory, "..", "..", "obfuscation-service"));
var obfuscation = (runMode && Directory.Exists(obfuscationPath)
        ? builder.AddDockerfile("obfuscation", obfuscationPath, "Dockerfile")
        : builder.AddContainer("obfuscation", "ghcr.io/bitmono-project/obfuscation-service:latest"))
    .WithHttpEndpoint(targetPort: ObfuscationPort, name: "http", env: "HTTP_PORTS")
    .WithEnvironment("DOTNET_hostBuilder__reloadConfigOnChange", "false");

if (!runMode)
{
    obfuscation.PublishAsDockerComposeService((_, service) => service.Restart = "always");
}

var migrations = builder.AddProject<Projects.BitMono_Web_MigrationService>("migrations")
    .WithReference(db)
    .WithReference(appdb)
    .WithEnvironment("DOTNET_hostBuilder__reloadConfigOnChange", "false")
    .WaitFor(db)
    .WaitFor(appdb);

var api = builder.AddProject<Projects.BitMono_Web_Api>("api", project => project.ExcludeLaunchProfile = true)
    .WithReference(db)
    .WithReference(redis)
    .WithReference(appdb)
    .WithEnvironment("Obfuscation__Url", obfuscation.GetEndpoint("http"))
    .WithEnvironment("DOTNET_hostBuilder__reloadConfigOnChange", "false")
    .WaitFor(db)
    .WaitFor(redis)
    .WaitFor(obfuscation)
    .WaitForCompletion(migrations);

IResourceBuilder<IResourceWithEndpoints> web;
IResourceBuilder<ContainerResource>? deployWeb = null;
if (runMode)
{
    api.WithHttpEndpoint(name: "http");

    // Propagate the AppHost's own environment to the children (api has ExcludeLaunchProfile, so it
    // gets no launchSettings env). The api (web) reads ASPNETCORE_ENVIRONMENT; the migrations worker
    // is a generic Host reading DOTNET_ENVIRONMENT — set both so dev-login, OpenAPI, the migrations
    // rebuild path, and sample seeding follow the AppHost env.
    var childEnvironment = builder.Environment.EnvironmentName;
    api.WithEnvironment("ASPNETCORE_ENVIRONMENT", childEnvironment);
    migrations.WithEnvironment("DOTNET_ENVIRONMENT", childEnvironment);

    web = builder.AddViteApp("web", "../frontend")
        .WithReference(api)
        .WithEnvironment("VITE_API_URL", api.GetEndpoint("http"))
        .WithEnvironment("VITE_APP_VERSION", imageTag)
        .WaitFor(api)
        .WithExternalHttpEndpoints();
}
else
{
    var blobsHostPath = $"{config["Deployment:RemoteDeployPath"] ?? "/opt/bitmono/web"}/blobs";
    api.WithHttpEndpoint(port: ApiDeployPort, targetPort: ApiDeployPort, name: "http", env: "HTTP_PORTS")
        .WithEnvironment("DOTNET_USE_POLLING_FILE_WATCHER", "1")
        .WithEnvironment("Storage__Disk__Path", "/data/blobs")
        .PublishAsDockerComposeService((_, service) =>
        {
            service.Restart = "always";
            // Persist crackme files across redeploys — bind a host dir on the single server.
            service.Volumes.Add(new Aspire.Hosting.Docker.Resources.ServiceNodes.Volume
            {
                Name = "bitmono-blobs",
                Type = "bind",
                Source = blobsHostPath,
                Target = "/data/blobs",
            });
        });

    // Secrets/config from the deploy pipeline (Deploy.yml -> Parameters__*). Each is optional —
    // wired only when provided, so OAuth/Turnstile/zip-password can be enabled independently.
    void WireParam(string envKey, string paramName, bool secret)
    {
        if (!string.IsNullOrEmpty(config[$"Parameters:{paramName}"]))
            api.WithEnvironment(envKey, builder.AddParameter(paramName, secret: secret));
    }

    WireParam("Auth__Discord__ClientId", "DiscordClientId", secret: false);
    WireParam("Auth__Discord__ClientSecret", "DiscordClientSecret", secret: true);
    WireParam("Auth__GitHub__ClientId", "GitHubClientId", secret: false);
    WireParam("Auth__GitHub__ClientSecret", "GitHubClientSecret", secret: true);
    WireParam("Crackmes__Turnstile__SiteKey", "TurnstileSiteKey", secret: false);
    WireParam("Crackmes__Turnstile__SecretKey", "TurnstileSecretKey", secret: true);
    WireParam("Crackmes__ZipPassword", "ZipPassword", secret: true);
        WireParam("Sentry__Dsn", "SentryDsn", secret: true);   // else the runner's DSN never reaches the api container

    deployWeb = builder.AddDockerfile("web", "../frontend")
        .WithHttpEndpoint(port: WebDeployPort, targetPort: WebDeployPort, env: "PORT")
        .WithBuildArg("APP_VERSION", imageTag)
        .WithEnvironment("API_URL", api.GetEndpoint("http"))
        .WithReference(api)
        .WaitFor(api)
        .PublishAsDockerComposeService((_, service) => service.Restart = "always")
        .WithExternalHttpEndpoints();

    web = deployWeb;
}

if (!string.IsNullOrEmpty(imageTag))
{
    api.WithImagePushOptions(context =>
    {
        context.Options.RemoteImageTag = imageTag;
    });
    migrations.WithImagePushOptions(context =>
    {
        context.Options.RemoteImageTag = imageTag;
    });
    if (deployWeb is not null)
    {
        deployWeb.WithImagePushOptions(async context =>
        {
            context.Options.RemoteImageTag = imageTag;
        });
    }
}

builder.Build().Run();

#pragma warning disable ASPIREPIPELINES003

var builder = DistributedApplication.CreateBuilder(args);

const string RestartUnlessStopped = "--restart=unless-stopped";
const int WebDeployPort = 8429;
const int ApiDeployPort = 8430;
const int ObfuscationPort = 8743;

var config = builder.Configuration;
var runMode = builder.ExecutionContext.IsRunMode;
var imageOwner = config["OWNER_LC"] ?? "bitmono-project";
var imageTag = config["IMAGE_TAG_SUFFIX"] ?? "dev";

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
var appdb = postgres.AddDatabase("appdb");

var redis = builder.AddRedis("redis")
    .WithDataVolume()
    .WithLifetime(ContainerLifetime.Persistent);
if (!runMode)
{
    redis.WithPassword(builder.AddParameter("RedisPassword", secret: true));
}

var obfuscationPath = Path.GetFullPath(Path.Combine(builder.AppHostDirectory, "..", "..", "obfuscation-service"));
var obfuscation = (runMode && Directory.Exists(obfuscationPath)
        ? builder.AddDockerfile("obfuscation", obfuscationPath, "Dockerfile")
        : builder.AddContainer("obfuscation", "ghcr.io/bitmono-project/obfuscation-service:latest"))
    .WithHttpEndpoint(targetPort: ObfuscationPort, name: "http", env: "HTTP_PORTS")
    .WithEnvironment("DOTNET_hostBuilder__reloadConfigOnChange", "false");

if (!runMode)
{
    obfuscation.WithContainerRuntimeArgs(RestartUnlessStopped);
}

IResourceBuilder<IResourceWithWaitSupport> migrations;
if (runMode)
{
    var migrationsBuilder = builder.AddProject<Projects.BitMono_Web_MigrationService>("migrations")
        .WithReference(appdb)
        .WithEnvironment("DOTNET_hostBuilder__reloadConfigOnChange", "false")
        .WaitFor(appdb);

    if (!string.IsNullOrEmpty(imageTag))
    {
        migrationsBuilder.WithImagePushOptions(context =>
        {
            context.Options.RemoteImageTag = imageTag;
        });
    }

    migrations = migrationsBuilder;
}
else
{
    var migrationsBuilder = builder.AddContainer("migrations", $"ghcr.io/{imageOwner}/web-migrations:latest")
        .WithReference(appdb)
        .WithEnvironment("DOTNET_hostBuilder__reloadConfigOnChange", "false")
        .WithContainerRuntimeArgs(RestartUnlessStopped)
        .WaitFor(appdb);

    if (!string.IsNullOrEmpty(imageTag))
    {
        migrationsBuilder.WithImagePushOptions(async context =>
        {
            context.Options.RemoteImageTag = imageTag;
        });
    }

    migrations = migrationsBuilder;
}

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

if (!string.IsNullOrEmpty(imageTag))
{
    api.WithImagePushOptions(context =>
    {
        context.Options.RemoteImageTag = imageTag;
    });
}

IResourceBuilder<IResourceWithEndpoints> web;
if (runMode)
{
    api.WithHttpEndpoint(name: "http");

    web = builder.AddViteApp("web", "../frontend")
        .WithReference(api)
        .WithEnvironment("VITE_API_URL", api.GetEndpoint("http"))
        .WithEnvironment("VITE_APP_VERSION", imageTag)
        .WaitFor(api)
        .WithExternalHttpEndpoints();
}
else
{
    api.WithHttpEndpoint(port: ApiDeployPort, targetPort: ApiDeployPort, name: "http", env: "HTTP_PORTS")
        .WithEnvironment("DOTNET_USE_POLLING_FILE_WATCHER", "1");

    var webBuilder = builder.AddDockerfile("web", "../frontend")
        .WithHttpEndpoint(port: WebDeployPort, targetPort: WebDeployPort, env: "PORT")
        .WithBuildArg("APP_VERSION", imageTag)
        .WithEnvironment("API_URL", api.GetEndpoint("http"))
        .WithReference(api)
        .WaitFor(api)
        .WithContainerRuntimeArgs(RestartUnlessStopped)
        .WithExternalHttpEndpoints();

    if (!string.IsNullOrEmpty(imageTag))
    {
        webBuilder.WithImagePushOptions(async context =>
        {
            context.Options.RemoteImageTag = imageTag;
        });
    }

    web = webBuilder;
}

builder.Build().Run();

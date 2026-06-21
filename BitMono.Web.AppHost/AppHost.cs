var builder = DistributedApplication.CreateBuilder(args);

const string RestartUnlessStopped = "--restart=unless-stopped";
const int ApiDeployPort = 8742;
const int ObfuscationPort = 8743;

var config = builder.Configuration;
var runMode = builder.ExecutionContext.IsRunMode;
var imageOwner = config["OWNER_LC"] ?? "bitmono-project";

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
    migrations = builder.AddProject<Projects.BitMono_Web_MigrationService>("migrations")
        .WithReference(appdb)
        .WithEnvironment("DOTNET_hostBuilder__reloadConfigOnChange", "false")
        .WaitFor(appdb);
}
else
{
    migrations = builder.AddContainer("migrations", $"ghcr.io/{imageOwner}/web-migrations:latest")
        .WithReference(appdb)
        .WithEnvironment("DOTNET_hostBuilder__reloadConfigOnChange", "false")
        .WithContainerRuntimeArgs(RestartUnlessStopped)
        .WaitFor(appdb);
}

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

var frontend = builder.AddViteApp("web", "../frontend")
    .WithReference(api)
    .WithEnvironment("VITE_API_URL", api.GetEndpoint("http"))
    .WaitFor(api);

if (runMode)
{
    frontend.WithExternalHttpEndpoints();
}
else
{
    api.WithHttpEndpoint(port: ApiDeployPort, targetPort: ApiDeployPort, name: "http", env: "HTTP_PORTS")
        .WithEnvironment("DOTNET_USE_POLLING_FILE_WATCHER", "1")
        .WithExternalHttpEndpoints();
}

#pragma warning disable ASPIREJAVASCRIPT001
api.PublishWithContainerFiles(frontend, "wwwroot");
#pragma warning restore ASPIREJAVASCRIPT001

builder.Build().Run();

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

var redis = builder.AddRedis("redis")
    .WithDataVolume()
    .WithLifetime(ContainerLifetime.Persistent);
if (!runMode)
{
    redis.WithPassword(builder.AddParameter("RedisPassword", secret: true));
}

builder.AddProject<Projects.BitMono_Web_Api>("api", launchProfileName: "http")
    .WithReference(db)
    .WithReference(redis)
    .WaitFor(db)
    .WaitFor(redis);

builder.Build().Run();

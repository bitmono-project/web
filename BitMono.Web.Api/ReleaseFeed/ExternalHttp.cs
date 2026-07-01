namespace BitMono.Web.Api.ReleaseFeed;

// Plain HttpClients for external third-party APIs. Deliberately NOT created via IHttpClientFactory: Aspire's
// ConfigureHttpClientDefaults wraps every factory client in service discovery (meant for INTERNAL resources)
// plus the standard resilience handler, and in the deployed container that pipeline fails the external
// api.github.com / virustotal.com calls fast — it works locally but 502s in prod. A direct HttpClient talks
// plain DNS like any normal client. PooledConnectionLifetime keeps DNS fresh for these long-lived singletons.

public sealed class GitHubHttp
{
    public HttpClient Client { get; }

    public GitHubHttp()
    {
        Client = new HttpClient(new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(5) })
        {
            BaseAddress = new Uri("https://api.github.com/"),
            Timeout = TimeSpan.FromMinutes(5),   // large release assets stream through the /download proxy
        };
        Client.DefaultRequestHeaders.UserAgent.ParseAdd("BitMono-Web");
        Client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
    }
}

public sealed class VirusTotalHttp
{
    public HttpClient Client { get; }

    public VirusTotalHttp(IConfiguration cfg)
    {
        Client = new HttpClient(new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(5) })
        {
            BaseAddress = new Uri("https://www.virustotal.com/api/v3/"),
            Timeout = TimeSpan.FromSeconds(30),
        };
        var key = cfg["VirusTotal:ApiKey"];
        if (!string.IsNullOrWhiteSpace(key))
            Client.DefaultRequestHeaders.Add("x-apikey", key);
    }
}

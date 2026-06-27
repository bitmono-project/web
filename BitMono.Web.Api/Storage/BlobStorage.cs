namespace BitMono.Web.Api.Storage;

// Crackme files live on local disk — a Docker volume on the server in prod, App_Data in dev.
// Single server (Hetzner), no object store. Key path-segments map to folders.
public sealed class BlobStorage(string root)
{
    public async Task SaveAsync(string key, Stream content, CancellationToken ct = default)
    {
        var path = PathFor(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var file = File.Create(path);
        await content.CopyToAsync(file, ct);
    }

    public Task<Stream?> OpenReadAsync(string key, CancellationToken ct = default)
    {
        var path = PathFor(key);
        Stream? stream = File.Exists(path) ? File.OpenRead(path) : null;
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string key, CancellationToken ct = default)
    {
        var path = PathFor(key);
        if (File.Exists(path))
            File.Delete(path);
        return Task.CompletedTask;
    }

    private string PathFor(string key)
    {
        var safe = key.Replace('\\', '/').TrimStart('/');
        var full = Path.GetFullPath(Path.Combine(root, safe.Replace('/', Path.DirectorySeparatorChar)));
        if (!full.StartsWith(Path.GetFullPath(root), StringComparison.Ordinal))
            throw new InvalidOperationException("Blob key escapes the storage root.");
        return full;
    }
}

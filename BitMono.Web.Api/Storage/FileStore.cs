namespace BitMono.Web.Api.Storage;

public enum JobStatus { NotFound, Pending, Done, Failed }

// Ephemeral file storage: inputs deleted right after obfuscation, outputs deleted on download.
public sealed class FileStore
{
    private readonly string _in;
    private readonly string _out;

    public FileStore(IConfiguration config)
    {
        var root = config["Storage:Root"] ?? Path.Combine(Path.GetTempPath(), "bitmono-web");
        _in = Path.Combine(root, "in");
        _out = Path.Combine(root, "out");
        Directory.CreateDirectory(_in);
        Directory.CreateDirectory(_out);
    }

    private string InputPath(Guid id) => Path.Combine(_in, id.ToString("N"));
    private string OutputPath(Guid id) => Path.Combine(_out, id.ToString("N"));
    private string FailedPath(Guid id) => Path.Combine(_out, id.ToString("N") + ".failed");

    public async Task SaveInputAsync(Guid id, Stream content, CancellationToken ct)
    {
        await using var file = File.Create(InputPath(id));
        await content.CopyToAsync(file, ct);
    }

    public Task<byte[]> ReadInputAsync(Guid id, CancellationToken ct) =>
        File.ReadAllBytesAsync(InputPath(id), ct);

    public Task SaveOutputAsync(Guid id, byte[] bytes, CancellationToken ct) =>
        File.WriteAllBytesAsync(OutputPath(id), bytes, ct);

    public async Task<byte[]?> TryReadOutputAsync(Guid id, CancellationToken ct) =>
        File.Exists(OutputPath(id)) ? await File.ReadAllBytesAsync(OutputPath(id), ct) : null;

    public void MarkFailed(Guid id) => File.WriteAllText(FailedPath(id), string.Empty);
    public void DeleteInput(Guid id) => File.Delete(InputPath(id));
    public void DeleteOutput(Guid id) => File.Delete(OutputPath(id));

    public JobStatus Status(Guid id)
    {
        if (File.Exists(OutputPath(id))) return JobStatus.Done;
        if (File.Exists(FailedPath(id))) return JobStatus.Failed;
        if (File.Exists(InputPath(id))) return JobStatus.Pending;
        return JobStatus.NotFound;
    }

    public int SweepOlderThan(TimeSpan age)
    {
        var cutoff = DateTime.UtcNow - age;
        var removed = 0;
        foreach (var dir in new[] { _in, _out })
            foreach (var file in Directory.EnumerateFiles(dir))
                if (File.GetLastWriteTimeUtc(file) < cutoff)
                {
                    File.Delete(file);
                    removed++;
                }
        return removed;
    }
}

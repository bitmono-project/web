using System.Net.Http.Headers;
using System.Net.Http.Json;
using BitMono.Web.Api.Models;

namespace BitMono.Web.Api.Obfuscation;

// Calls the obfuscation-service over HTTP (URL injected by Aspire as Obfuscation:Url). Protections
// are forwarded as repeated form fields; the service validates/defaults them.
public sealed class RemoteObfuscationService(IHttpClientFactory factory) : IObfuscationService
{
    public async Task<byte[]> ObfuscateAsync(
        string fileName,
        byte[] input,
        IReadOnlyList<string> protections,
        IReadOnlyList<byte[]> dependencies,
        byte[]? signingKey,
        CancellationToken ct)
    {
        var http = factory.CreateClient("obfuscation");

        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(input);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(fileContent, "file", fileName);
        foreach (var protection in protections)
            form.Add(new StringContent(protection), "protections");

        // Dependency assemblies — the service reads each one's real name itself, so the part filenames
        // are cosmetic. Sent as repeated "dependencies" file parts.
        for (var i = 0; i < dependencies.Count; i++)
        {
            var dep = new ByteArrayContent(dependencies[i]);
            dep.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            form.Add(dep, "dependencies", $"dependency-{i}.dll");
        }

        if (signingKey is { Length: > 0 })
        {
            var key = new ByteArrayContent(signingKey);
            key.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            form.Add(key, "signingKey", "signing.snk");
        }

        using var response = await http.PostAsync("/obfuscate", form, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsByteArrayAsync(ct);
    }

    public async Task<VersionResponse> GetVersionAsync(CancellationToken ct)
    {
        var http = factory.CreateClient("obfuscation");
        return await http.GetFromJsonAsync<VersionResponse>("/version", ct)
            ?? throw new InvalidOperationException("Obfuscation service returned no version.");
    }
}

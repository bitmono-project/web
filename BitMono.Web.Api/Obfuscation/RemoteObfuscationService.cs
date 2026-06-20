using System.Net.Http.Headers;

namespace BitMono.Web.Api.Obfuscation;

// Calls the obfuscation-service over HTTP (URL injected by Aspire as Obfuscation:Url). Protections
// are forwarded as repeated form fields; the service validates/defaults them.
public sealed class RemoteObfuscationService(IHttpClientFactory factory) : IObfuscationService
{
    public async Task<byte[]> ObfuscateAsync(string fileName, byte[] input, IReadOnlyList<string> protections, CancellationToken ct)
    {
        var http = factory.CreateClient("obfuscation");

        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(input);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(fileContent, "file", fileName);
        foreach (var protection in protections)
            form.Add(new StringContent(protection), "protections");

        using var response = await http.PostAsync("/obfuscate", form, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsByteArrayAsync(ct);
    }
}

using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using BitMono.Web.Api.Models;
using BitMono.Web.Api.Storage;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

namespace BitMono.Web.Tests;

public class ObfuscateEndToEndTests
{
    private static readonly TimeSpan Timeout = TimeSpan.FromMinutes(2);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    [Fact]
    public async Task Upload_obfuscate_download_roundtrip()
    {
        var appHost = await DistributedApplicationTestingBuilder.CreateAsync<Projects.BitMono_Web_AppHost>();
        appHost.Services.ConfigureHttpClientDefaults(client => client.AddStandardResilienceHandler());

        await using var app = await appHost.BuildAsync().WaitAsync(Timeout);
        await app.StartAsync().WaitAsync(Timeout);

        var http = app.CreateHttpClient("api");
        await app.ResourceNotifications.WaitForResourceHealthyAsync("api").WaitAsync(Timeout);

        var id = await PostSampleAsync(http);
        var status = await PollStatusAsync(http, id, Timeout);
        Assert.Equal(JobStatus.Done, status);

        var download = await http.GetAsync($"/obfuscate/{id}/download");
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        var output = await download.Content.ReadAsByteArrayAsync();
        Assert.True(output.Length > 1 && output[0] == (byte)'M' && output[1] == (byte)'Z', "output is not a PE");
    }

    private static async Task<Guid> PostSampleAsync(HttpClient http)
    {
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(CompileSampleAssembly());
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(file, "file", "Sample.dll");

        var post = await http.PostAsync("/obfuscate", form);
        Assert.Equal(HttpStatusCode.Accepted, post.StatusCode);
        return (await post.Content.ReadFromJsonAsync<ObfuscateAcceptedResponse>(Json))!.Id;
    }

    private static async Task<JobStatus> PollStatusAsync(HttpClient http, Guid id, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        var status = JobStatus.Pending;
        while (DateTime.UtcNow < deadline)
        {
            status = (await http.GetFromJsonAsync<ObfuscateStatusResponse>($"/obfuscate/{id}", Json))!.Status;
            if (status != JobStatus.Pending)
                break;
            await Task.Delay(1000);
        }
        return status;
    }

    private static byte[] CompileSampleAssembly()
    {
        var tree = CSharpSyntaxTree.ParseText(
            "public class Sample { public int Add(int a, int b) => a + b; public string Greet(string n) => \"hi \" + n; }");
        var references = new[] { MetadataReference.CreateFromFile(typeof(object).Assembly.Location) };
        var compilation = CSharpCompilation.Create("Sample", [tree], references,
            new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));

        using var ms = new MemoryStream();
        Assert.True(compilation.Emit(ms).Success, "sample assembly failed to compile");
        return ms.ToArray();
    }
}

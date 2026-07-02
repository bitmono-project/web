using BitMono.Web.Api.ReleaseFeed;
using Microsoft.AspNetCore.Mvc;

namespace BitMono.Web.Api.Controllers;

// TEMPORARY: walk one small asset through the VirusTotal flow (lookup → download → upload) and report each
// step's status + body, so we can see why nothing reaches "done". Non-sensitive. Remove after diagnosing.
[ApiController]
public sealed class VtDiagController(ReleaseCatalog catalog, IHttpClientFactory factory, IConfiguration cfg) : ControllerBase
{
    [HttpGet("api/releases/vtdiag")]
    public async Task<IActionResult> Diag(CancellationToken ct)
    {
        var hasKey = !string.IsNullOrWhiteSpace(cfg["VirusTotal:ApiKey"]);
        var data = await catalog.GetAsync(ct);
        var a = data?.Assets.FirstOrDefault(x => x.Sha256 is not null && x.Size < 32L * 1024 * 1024);
        if (a is null)
            return Ok(new { hasKey, error = "no small asset in catalog" });

        var vt = factory.CreateClient("virustotal");
        var gh = factory.CreateClient("github");
        var steps = new List<object>();
        try
        {
            var get = await vt.GetAsync($"files/{a.Sha256}", ct);
            var getBody = await get.Content.ReadAsStringAsync(ct);
            steps.Add(new { step = "GET files/{sha}", status = (int)get.StatusCode, bodyStart = Trim(getBody) });

            if (get.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                var bytes = await gh.GetByteArrayAsync(a.SourceUrl, ct);
                steps.Add(new { step = "download from GitHub", bytes = bytes.Length });

                using var form = new MultipartFormDataContent();
                form.Add(new ByteArrayContent(bytes), "file", a.Sha256!);
                var post = await vt.PostAsync("files", form, ct);
                var postBody = await post.Content.ReadAsStringAsync(ct);
                steps.Add(new { step = "POST files", status = (int)post.StatusCode, bodyStart = Trim(postBody) });
            }
        }
        catch (Exception ex)
        {
            steps.Add(new { error = ex.GetType().Name, message = ex.Message, inner = ex.InnerException?.Message });
        }
        return Ok(new { hasKey, sha = a.Sha256, name = a.Name, size = a.Size, steps });
    }

    private static string Trim(string s) => s.Length > 300 ? s[..300] : s;
}

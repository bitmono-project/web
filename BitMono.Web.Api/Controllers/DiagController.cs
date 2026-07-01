using BitMono.Web.Api.ReleaseFeed;
using Microsoft.AspNetCore.Mvc;

namespace BitMono.Web.Api.Controllers;

// TEMPORARY diagnostic: surfaces exactly why the deployed container can't reach the GitHub API (DNS vs
// egress vs 403 vs TLS). Returns only non-sensitive error metadata. Remove once the release feed is fixed.
[ApiController]
public sealed class DiagController(GitHubHttp github) : ControllerBase
{
    [HttpGet("api/releases/diag")]
    public async Task<IActionResult> Diag(CancellationToken ct)
    {
        try
        {
            var res = await github.Client.GetAsync("repos/bitmono-project/BitMono/releases/latest", ct);
            var body = await res.Content.ReadAsStringAsync(ct);
            return Ok(new
            {
                ok = res.IsSuccessStatusCode,
                status = (int)res.StatusCode,
                bodyStart = body.Length > 240 ? body[..240] : body,
            });
        }
        catch (Exception ex)
        {
            return Ok(new
            {
                ok = false,
                error = ex.GetType().FullName,
                message = ex.Message,
                inner = ex.InnerException?.GetType().FullName,
                innerMessage = ex.InnerException?.Message,
            });
        }
    }
}

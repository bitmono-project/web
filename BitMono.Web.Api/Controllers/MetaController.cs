using System.Net.Http.Json;
using BitMono.Web.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace BitMono.Web.Api.Controllers;

[ApiController]
public sealed class MetaController(IHttpClientFactory factory) : ControllerBase
{
    [HttpGet("version")]
    public async Task<ActionResult<VersionResponse>> Version(CancellationToken ct)
    {
        var result = await factory.CreateClient("obfuscation").GetFromJsonAsync<VersionResponse>("/version", ct);
        return result is null ? StatusCode(StatusCodes.Status502BadGateway) : result;
    }

    [HttpGet("protections")]
    public async Task<ActionResult<ProtectionInfo[]>> Protections(CancellationToken ct)
    {
        var result = await factory.CreateClient("obfuscation").GetFromJsonAsync<ProtectionInfo[]>("/protections", ct);
        return result is null ? StatusCode(StatusCodes.Status502BadGateway) : result;
    }
}

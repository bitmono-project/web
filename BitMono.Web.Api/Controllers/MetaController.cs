using System.Net.Http.Json;
using BitMono.Web.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace BitMono.Web.Api.Controllers;

[ApiController]
public sealed class MetaController(IHttpClientFactory factory) : ControllerBase
{
    [HttpGet("version")]
    public async Task<IActionResult> Version(CancellationToken ct)
    {
        var result = await factory.CreateClient("obfuscation").GetFromJsonAsync<VersionResponse>("/version", ct);
        if (result is null)
            return StatusCode(StatusCodes.Status502BadGateway);
        return Ok(result);
    }

    [HttpGet("protections")]
    public async Task<IActionResult> Protections(CancellationToken ct)
    {
        var result = await factory.CreateClient("obfuscation").GetFromJsonAsync<ProtectionInfo[]>("/protections", ct);
        if (result is null)
            return StatusCode(StatusCodes.Status502BadGateway);
        return Ok(result);
    }
}

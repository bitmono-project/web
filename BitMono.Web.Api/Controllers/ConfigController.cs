using BitMono.Web.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace BitMono.Web.Api.Controllers;

[ApiController]
[Route("api/config")]
[ResponseCache(NoStore = true)]   // dynamic — never let the browser cache a stale config/provider state
public sealed class ConfigController(IConfiguration cfg) : ControllerBase
{
    [HttpGet]
    public AppConfigResponse Get() => new(cfg["Crackmes:Turnstile:SiteKey"], cfg["Crackmes:ZipPassword"] ?? "bitmono.dev");
}

using BitMono.Web.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace BitMono.Web.Api.Controllers;

[ApiController]
[Route("api/config")]
public sealed class ConfigController(IConfiguration cfg) : ControllerBase
{
    [HttpGet]
    public AppConfigResponse Get() => new(cfg["Crackmes:Turnstile:SiteKey"]);
}

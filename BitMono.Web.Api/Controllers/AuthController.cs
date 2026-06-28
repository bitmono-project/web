using System.Security.Claims;
using AspNet.Security.OAuth.Discord;
using AspNet.Security.OAuth.GitHub;
using BitMono.Web.Api.Auth;
using BitMono.Web.Api.Models;
using BitMono.Web.Data;
using BitMono.Web.Data.Entities;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Controllers;

[ApiController]
[Route("api/auth")]
[ResponseCache(NoStore = true)]   // auth state (me/providers) must never be cached by the browser
public sealed class AuthController(IWebHostEnvironment env, IAuthenticationSchemeProvider schemes, IServiceScopeFactory scopeFactory) : ControllerBase
{
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        if (User.Identity?.IsAuthenticated != true)
            return Ok((MeResponse?)null);

        // Handle (profile slug) isn't a claim — look it up by uid so the nav can link the name to /user/{handle}.
        string? handle = null;
        if (Guid.TryParse(User.FindFirstValue("uid"), out var uid))
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();
            handle = await db.Users.AsNoTracking().Where(u => u.Id == uid).Select(u => u.Handle).FirstOrDefaultAsync(ct);
        }

        return Ok(new MeResponse(
            User.FindFirstValue("uid") ?? "",
            User.Identity.Name ?? "user",
            handle,
            User.FindFirstValue(ClaimTypes.Role) ?? nameof(UserRole.User),
            User.FindFirstValue("avatar")));
    }

    [HttpGet("providers")]
    public async Task<ProvidersResponse> Providers()
    {
        var names = (await schemes.GetAllSchemesAsync()).Select(s => s.Name).ToHashSet();
        return new ProvidersResponse(
            names.Contains(DiscordAuthenticationDefaults.AuthenticationScheme),
            names.Contains(GitHubAuthenticationDefaults.AuthenticationScheme),
            env.IsDevelopment());
    }

    [HttpGet("login/{provider}")]
    public async Task<IActionResult> Login(string provider, [FromQuery] string? returnUrl)
    {
        var scheme = provider.ToLowerInvariant() switch
        {
            "discord" => DiscordAuthenticationDefaults.AuthenticationScheme,
            "github" => GitHubAuthenticationDefaults.AuthenticationScheme,
            _ => null,
        };
        if (scheme is null || await schemes.GetSchemeAsync(scheme) is null)
            return BadRequest("That provider isn't configured.");
        return Challenge(new AuthenticationProperties { RedirectUri = SafeReturn(returnUrl) }, scheme);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    // Dev-only shortcut so the full upload→moderate→download loop is testable without OAuth apps.
    [HttpPost("dev-login")]
    public async Task<IActionResult> DevLogin([FromBody] DevLoginRequest req, [FromServices] UserService users)
    {
        if (!env.IsDevelopment())
            return NotFound();

        var handle = string.IsNullOrWhiteSpace(req.Handle) ? "dev" : req.Handle.Trim();
        var role = req.Admin ? UserRole.Admin : UserRole.User;
        var user = await users.FindOrCreateAsync("dev", handle, handle, null, null, role);

        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, UserService.BuildPrincipal(user));
        return Ok(new MeResponse(user.Id.ToString(), user.DisplayName, user.Handle, user.Role.ToString(), user.AvatarUrl));
    }

    private string SafeReturn(string? url) => !string.IsNullOrEmpty(url) && Url.IsLocalUrl(url) ? url : "/";
}

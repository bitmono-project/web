using System.Security.Claims;
using AspNet.Security.OAuth.Discord;
using AspNet.Security.OAuth.GitHub;
using BitMono.Web.Data;
using BitMono.Web.Data.Entities;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OAuth;

namespace BitMono.Web.Api.Auth;

// Cookie auth + OAuth (Discord/GitHub). Each provider is registered only when its ClientId is
// configured, so dev runs fine with just the dev-login endpoint. No passwords ever.
public static class AuthSetup
{
    public const string ModeratorPolicy = "Moderator";
    public const string AdminPolicy = "Admin";

    public static void AddBitMonoAuth(this WebApplicationBuilder builder)
    {
        var cfg = builder.Configuration;

        var auth = builder.Services
            .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = "bitmono.sid";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                options.ExpireTimeSpan = TimeSpan.FromDays(30);
                options.SlidingExpiration = true;
                // This is an API: answer with status codes, never redirect to a login page.
                options.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; };
                options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = StatusCodes.Status403Forbidden; return Task.CompletedTask; };
            });

        var discordId = cfg["Auth:Discord:ClientId"];
        if (!string.IsNullOrEmpty(discordId))
        {
            auth.AddDiscord(o =>
            {
                o.ClientId = discordId;
                o.ClientSecret = cfg["Auth:Discord:ClientSecret"] ?? "";
                o.CallbackPath = "/api/auth/discord/callback";
                o.Events.OnCreatingTicket = LinkAccount("discord");
            });
        }

        var githubId = cfg["Auth:GitHub:ClientId"];
        if (!string.IsNullOrEmpty(githubId))
        {
            auth.AddGitHub(o =>
            {
                o.ClientId = githubId;
                o.ClientSecret = cfg["Auth:GitHub:ClientSecret"] ?? "";
                o.CallbackPath = "/api/auth/github/callback";
                o.Scope.Add("read:user");
                o.Events.OnCreatingTicket = LinkAccount("github");
            });
        }

        builder.Services.AddAuthorization(o =>
        {
            o.AddPolicy(ModeratorPolicy, p => p.RequireRole(nameof(UserRole.Moderator), nameof(UserRole.Admin)));
            o.AddPolicy(AdminPolicy, p => p.RequireRole(nameof(UserRole.Admin)));
        });

        builder.Services.AddScoped<UserService>();
    }

    // After the provider hands us the external identity, find-or-create our account and stamp
    // our own uid + role claims onto the cookie.
    private static Func<OAuthCreatingTicketContext, Task> LinkAccount(string provider) => async ctx =>
    {
        var providerUserId = ctx.Identity?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(providerUserId))
            return;

        var users = ctx.HttpContext.RequestServices.GetRequiredService<UserService>();
        var name = ctx.Identity?.FindFirst(ClaimTypes.Name)?.Value ?? $"{provider}-user";
        var email = ctx.Identity?.FindFirst(ClaimTypes.Email)?.Value;

        var user = await users.FindOrCreateAsync(provider, providerUserId, name, null, email);
        ctx.Identity!.AddClaim(new Claim("uid", user.Id.ToString()));
        ctx.Identity.AddClaim(new Claim(ClaimTypes.Role, user.Role.ToString()));
    };
}

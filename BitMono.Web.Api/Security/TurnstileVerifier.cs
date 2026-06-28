using System.Net.Http.Json;

namespace BitMono.Web.Api.Security;

// Cloudflare Turnstile (captcha) for uploads. Config-gated: when no secret is set it's a no-op,
// so dev and unconfigured deploys aren't blocked. Behind Cloudflare anyway, so this is belt-and-braces.
public sealed class TurnstileVerifier(IHttpClientFactory httpFactory, IConfiguration cfg)
{
    private const string VerifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
    // Hidden form field the Turnstile widget injects with the solved token.
    public const string FormField = "cf-turnstile-response";

    public async Task<bool> VerifyAsync(string? token, string? ip, CancellationToken ct = default)
    {
        var secret = cfg["Crackmes:Turnstile:SecretKey"];
        if (string.IsNullOrEmpty(secret))
            return true; // not configured → skip
        if (string.IsNullOrEmpty(token))
            return false;

        var form = new Dictionary<string, string> { ["secret"] = secret, ["response"] = token };
        if (!string.IsNullOrEmpty(ip))
            form["remoteip"] = ip;

        try
        {
            var response = await httpFactory.CreateClient("turnstile")
                .PostAsync(VerifyUrl, new FormUrlEncodedContent(form), ct);
            if (!response.IsSuccessStatusCode)
                return false;
            var result = await response.Content.ReadFromJsonAsync<SiteVerifyResponse>(ct);
            return result?.Success == true;
        }
        catch
        {
            return false;
        }
    }

    private sealed record SiteVerifyResponse(bool Success);
}

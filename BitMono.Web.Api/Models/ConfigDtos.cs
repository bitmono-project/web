namespace BitMono.Web.Api.Models;

// Public client config (no secrets). Turnstile site key + download-zip password are public by design.
public sealed record AppConfigResponse(string? TurnstileSiteKey, string ZipPassword);

namespace BitMono.Web.Api.Models;

// Public client config (no secrets). Turnstile site key is public by design.
public sealed record AppConfigResponse(string? TurnstileSiteKey);

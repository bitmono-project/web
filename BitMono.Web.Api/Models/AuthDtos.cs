namespace BitMono.Web.Api.Models;

public sealed record MeResponse(string Id, string Name, string Role, string? Avatar);

// Note: property is "Github" (not "GitHub") so camelCase serializes to "github", not "gitHub".
public sealed record ProvidersResponse(bool Discord, bool Github, bool Dev);

public sealed record DevLoginRequest(string? Handle, bool Admin);

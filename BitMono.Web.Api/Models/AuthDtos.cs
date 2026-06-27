namespace BitMono.Web.Api.Models;

public sealed record MeResponse(string Id, string Name, string Role, string? Avatar);

public sealed record ProvidersResponse(bool Discord, bool GitHub, bool Dev);

public sealed record DevLoginRequest(string? Handle, bool Admin);

using BitMono.Web.Api.Storage;

namespace BitMono.Web.Api.Models;

public sealed record ObfuscateAcceptedResponse(Guid Id);

public sealed record ObfuscateStatusResponse(Guid Id, JobStatus Status);

public sealed record VersionResponse(string BitMono, uint Packed);

public sealed record ProtectionInfo(
    string Name, string Description, string Category, bool Stable, string? Note, string? MinLevel);

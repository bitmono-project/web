using BitMono.Web.Api.Storage;

namespace BitMono.Web.Api.Models;

public sealed record ObfuscateAcceptedResponse(Guid Id);

public sealed record ObfuscateStatusResponse(Guid Id, JobStatus Status);

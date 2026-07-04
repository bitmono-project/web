namespace BitMono.Web.Api.Models;

// One hint as the viewer sees it. Body is null while locked (unless the viewer owns/solved the
// crackme or is staff); Unlocked marks the ones they've paid for.
public sealed record HintItem(Guid Id, int Order, int CostPercent, bool Unlocked, string? Body);

public sealed record HintCreateRequest(string Body, int CostPercent);

// Returned on unlock so the UI can reveal the body inline and show the running penalty.
public sealed record HintUnlockResult(string Body, int CostPercent);

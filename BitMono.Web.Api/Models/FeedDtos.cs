namespace BitMono.Web.Api.Models;

// One line in the home activity feed. Kind is "solve" | "firstBlood" | "published"; the other fields
// are filled per kind (actor = who did it, crackme = what it was about).
public sealed record ActivityItem(
    string Kind,
    string? ActorName,
    string? ActorHandle,
    string CrackmeTitle,
    string CrackmeSlug,
    int? Points,
    DateTime At);

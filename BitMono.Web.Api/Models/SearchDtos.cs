using BitMono.Web.Data;

namespace BitMono.Web.Api.Models;

public sealed record SearchResponse(
    IReadOnlyList<SearchCrackme> Crackmes,
    IReadOnlyList<SearchUser> Users,
    IReadOnlyList<SearchWriteup> Writeups);

public sealed record SearchCrackme(string Slug, string Title, string Author, Difficulty Difficulty);

public sealed record SearchUser(string Handle, string DisplayName, string? Avatar, int Points);

public sealed record SearchWriteup(Guid Id, string Title, string CrackmeSlug, string CrackmeTitle, string Author);

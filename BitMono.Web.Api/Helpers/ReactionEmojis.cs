namespace BitMono.Web.Api.Helpers;

public static class ReactionEmojis
{
    // The allowed reaction palette. Keep in sync with the frontend's REACTIONS list.
    public static readonly string[] Allowed = ["👍", "❤️", "🔥", "🤯", "😂"];

    public static bool IsValid(string? emoji) => emoji is not null && Array.IndexOf(Allowed, emoji) >= 0;
}

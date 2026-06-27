using System.Text;

namespace BitMono.Web.Api.Helpers;

public static class Slug
{
    // lowercase, alphanumerics + single dashes; capped. Uniqueness is the caller's job.
    public static string From(string title)
    {
        var sb = new StringBuilder(title.Length);
        foreach (var ch in title.Trim().ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(ch))
                sb.Append(ch);
            else if ((ch is ' ' or '-' or '_' or '.') && sb.Length > 0 && sb[^1] != '-')
                sb.Append('-');
        }
        var slug = sb.ToString().Trim('-');
        if (slug.Length > 70)
            slug = slug[..70].Trim('-');
        return slug.Length == 0 ? "crackme" : slug;
    }
}

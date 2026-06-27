using System.Security.Claims;
using BitMono.Web.Api.Helpers;
using BitMono.Web.Data;
using BitMono.Web.Data.Entities;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

namespace BitMono.Web.Api.Auth;

// Find-or-create the account behind an OAuth (or dev) login, and build its cookie principal.
public sealed class UserService(IServiceScopeFactory scopeFactory)
{
    public async Task<User> FindOrCreateAsync(
        string provider, string providerUserId, string displayName,
        string? avatarUrl, string? email, UserRole? roleOverride = null, CancellationToken ct = default)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrackmesDbContext>();

        var user = await db.Users.FirstOrDefaultAsync(
            u => u.Provider == provider && u.ProviderUserId == providerUserId, ct);
        var now = DateTime.UtcNow;

        if (user is null)
        {
            user = new User
            {
                Id = Guid.NewGuid(),
                Provider = provider,
                ProviderUserId = providerUserId,
                DisplayName = Trim(displayName, 80),
                Handle = await UniqueHandleAsync(db, displayName, ct),
                AvatarUrl = avatarUrl,
                Email = email,
                Role = roleOverride ?? UserRole.User,
                CreatedAt = now,
                LastLoginAt = now,
            };
            db.Users.Add(user);
        }
        else
        {
            user.DisplayName = Trim(displayName, 80);
            if (string.IsNullOrEmpty(user.Handle)) // backfill pre-existing accounts on their next login
                user.Handle = await UniqueHandleAsync(db, user.DisplayName, ct);
            if (avatarUrl is not null) user.AvatarUrl = avatarUrl;
            if (email is not null) user.Email = email;
            if (roleOverride is { } role) user.Role = role;
            user.LastLoginAt = now;
        }

        await db.SaveChangesAsync(ct);
        return user;
    }

    // A handle slugged from the display name, de-duplicated like crackme slugs (-2, -3, ...).
    private static async Task<string> UniqueHandleAsync(CrackmesDbContext db, string displayName, CancellationToken ct)
    {
        var baseHandle = Slug.From(displayName);
        var handle = baseHandle;
        var n = 1;
        while (await db.Users.AnyAsync(u => u.Handle == handle, ct))
            handle = $"{baseHandle}-{++n}";
        return handle;
    }

    public static ClaimsPrincipal BuildPrincipal(User user)
    {
        var claims = new List<Claim>
        {
            new("uid", user.Id.ToString()),
            new(ClaimTypes.Name, user.DisplayName),
            new(ClaimTypes.Role, user.Role.ToString()),
        };
        if (user.AvatarUrl is not null) claims.Add(new Claim("avatar", user.AvatarUrl));
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        return new ClaimsPrincipal(identity);
    }

    private static string Trim(string s, int max) => s.Length <= max ? s : s[..max];
}

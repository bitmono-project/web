using System.Security.Claims;
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
            if (avatarUrl is not null) user.AvatarUrl = avatarUrl;
            if (email is not null) user.Email = email;
            if (roleOverride is { } role) user.Role = role;
            user.LastLoginAt = now;
        }

        await db.SaveChangesAsync(ct);
        return user;
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

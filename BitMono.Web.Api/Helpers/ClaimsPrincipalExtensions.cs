using System.Security.Claims;

namespace BitMono.Web.Api.Helpers;

// The session cookie carries the user id in a "uid" claim — these two are the only ways any
// endpoint should read it.
public static class ClaimsPrincipalExtensions
{
    // Null when anonymous — for endpoints that serve both signed-in and guest views.
    public static Guid? UserIdOrNull(this ClaimsPrincipal user) =>
        user.Identity?.IsAuthenticated == true && Guid.TryParse(user.FindFirstValue("uid"), out var id) ? id : null;

    // For [Authorize] endpoints, where the claim is guaranteed.
    public static Guid UserId(this ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirstValue("uid")!);
}

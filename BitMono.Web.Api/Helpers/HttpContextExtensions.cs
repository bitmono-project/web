using System.Net;

namespace BitMono.Web.Api.Helpers;

public static class HttpContextExtensions
{
    private const string CloudflareIpHeader = "CF-Connecting-IP";
    private const string ForwardedForHeader = "X-Forwarded-For";
    private const string LocalhostIpV4 = "127.0.0.1";
    private const string LocalhostIpV6 = "::1";
    private const string Unknown = "unknown";

    // Real client IP behind proxies. Priority: Cloudflare CF-Connecting-IP > RemoteIpAddress > X-Forwarded-For (rightmost).
    public static string GetClientIp(this HttpContext context)
    {
        var cloudflare = context.Request.Headers[CloudflareIpHeader].ToString();
        if (!string.IsNullOrEmpty(cloudflare))
            return cloudflare;

        var remoteIp = context.Connection.RemoteIpAddress?.ToString();
        if (!string.IsNullOrEmpty(remoteIp) && remoteIp != LocalhostIpV4 && remoteIp != LocalhostIpV6)
            return remoteIp;

        var forwardedFor = context.Request.Headers[ForwardedForHeader].ToString();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            var addresses = forwardedFor.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (addresses.Length > 0 && IPAddress.TryParse(addresses[^1], out _))
                return addresses[^1];
        }

        return remoteIp ?? Unknown;
    }
}

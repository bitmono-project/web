using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Microsoft.Extensions.Hosting;

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken ct)
    {
        if (exception is OperationCanceledException)
            return false;

        logger.LogError(exception, "Unhandled exception in {Method} {Path}",
            httpContext.Request.Method, httpContext.Request.Path);

        SentrySdk.CaptureException(exception, scope =>
        {
            scope.SetExtra("request_method", httpContext.Request.Method);
            scope.SetExtra("request_path", httpContext.Request.Path.ToString());
        });

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(new { error = "An unexpected error occurred" }, ct);
        return true;
    }
}

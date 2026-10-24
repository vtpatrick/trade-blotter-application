using System.Diagnostics;
using System.Reflection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using TradeBlotter.Api.Contracts;

namespace TradeBlotter.Api.Controllers;

/// <summary>
/// Heartbeat / status endpoint. Aggregates every registered health check
/// (see <c>AddHealthChecks()</c> in Program.cs) so new dependencies such as a
/// database or market-data feed only need to register a check to show up here.
/// </summary>
[ApiController]
[Route("api/health")]
public sealed class HealthController(
    HealthCheckService healthCheckService,
    IWebHostEnvironment environment,
    TimeProvider timeProvider) : ControllerBase
{
    private static readonly DateTimeOffset StartedAtUtc =
        Process.GetCurrentProcess().StartTime.ToUniversalTime();

    private static readonly string Version =
        typeof(Program).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion ?? "unknown";

    [HttpGet]
    [ProducesResponseType<HealthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<HealthResponse>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<HealthResponse>> Get(CancellationToken cancellationToken)
    {
        var report = await healthCheckService.CheckHealthAsync(cancellationToken);
        var now = timeProvider.GetUtcNow();

        var response = new HealthResponse(
            Status: report.Status.ToString(),
            Service: environment.ApplicationName,
            Version: Version,
            Environment: environment.EnvironmentName,
            ServerTimeUtc: now,
            StartedAtUtc: StartedAtUtc,
            UptimeSeconds: Math.Round((now - StartedAtUtc).TotalSeconds, 1),
            TotalDurationMs: report.TotalDuration.TotalMilliseconds,
            Checks: report.Entries
                .Select(e => new HealthCheckEntry(
                    e.Key,
                    e.Value.Status.ToString(),
                    e.Value.Description,
                    e.Value.Duration.TotalMilliseconds))
                .ToList());

        // Degraded still serves traffic; only Unhealthy is reported as 503.
        var statusCode = report.Status == HealthStatus.Unhealthy
            ? StatusCodes.Status503ServiceUnavailable
            : StatusCodes.Status200OK;

        return StatusCode(statusCode, response);
    }
}

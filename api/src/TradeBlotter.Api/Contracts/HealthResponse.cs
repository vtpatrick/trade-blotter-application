namespace TradeBlotter.Api.Contracts;

/// <summary>
/// Heartbeat payload returned by <c>GET /api/health</c>.
/// </summary>
public sealed record HealthResponse(
    string Status,
    string Service,
    string Version,
    string Environment,
    DateTimeOffset ServerTimeUtc,
    DateTimeOffset StartedAtUtc,
    double UptimeSeconds,
    double TotalDurationMs,
    IReadOnlyList<HealthCheckEntry> Checks);

public sealed record HealthCheckEntry(
    string Name,
    string Status,
    string? Description,
    double DurationMs);

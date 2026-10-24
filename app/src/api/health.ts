/** Mirrors api/src/TradeBlotter.Api/Contracts/HealthResponse.cs */
export type HealthStatus = 'Healthy' | 'Degraded' | 'Unhealthy'

export interface HealthCheckEntry {
  name: string
  status: HealthStatus
  description: string | null
  durationMs: number
}

export interface HealthResponse {
  status: HealthStatus
  service: string
  version: string
  environment: string
  serverTimeUtc: string
  startedAtUtc: string
  uptimeSeconds: number
  totalDurationMs: number
  checks: HealthCheckEntry[]
}

/** The API could not be reached or did not return a health report. */
export class ApiUnreachableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiUnreachableError'
  }
}

const REQUEST_TIMEOUT_MS = 5_000

/**
 * Calls GET /api/health. Resolves with the report for both 200 (Healthy/Degraded)
 * and 503 (Unhealthy); rejects with ApiUnreachableError when there is no report,
 * e.g. the API is down (the Vite proxy answers with a plain-text 502) or times out.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  let response: Response
  try {
    response = await fetch('/api/health', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    const reason =
      error instanceof DOMException && error.name === 'TimeoutError'
        ? `timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
        : 'network error'
    throw new ApiUnreachableError(`API unreachable (${reason})`)
  }

  const isReport =
    (response.ok || response.status === 503) &&
    response.headers.get('content-type')?.includes('application/json')

  if (!isReport) {
    throw new ApiUnreachableError(`API unreachable (HTTP ${response.status})`)
  }

  return (await response.json()) as HealthResponse
}

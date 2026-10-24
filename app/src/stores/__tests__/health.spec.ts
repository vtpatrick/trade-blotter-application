import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useHealthStore } from '../health'
import type { HealthResponse } from '@/api/health'

function healthReport(status: HealthResponse['status']): HealthResponse {
  return {
    status,
    service: 'TradeBlotter.Api',
    version: '1.0.0',
    environment: 'Development',
    serverTimeUtc: '2026-10-24T12:00:00Z',
    startedAtUtc: '2026-10-24T11:00:00Z',
    uptimeSeconds: 3600,
    totalDurationMs: 0.5,
    checks: [{ name: 'self', status, description: null, durationMs: 0.1 }],
  }
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

describe('health store', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('starts in the connecting state', () => {
    expect(useHealthStore().state).toBe('connecting')
  })

  it('reports healthy when the API returns 200 Healthy', async () => {
    fetchMock.mockResolvedValue(jsonResponse(healthReport('Healthy'), 200))
    const store = useHealthStore()

    await store.check()

    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.anything())
    expect(store.state).toBe('healthy')
    expect(store.report?.service).toBe('TradeBlotter.Api')
    expect(store.error).toBeNull()
    expect(store.latencyMs).not.toBeNull()
    expect(store.lastCheckedAt).toBeInstanceOf(Date)
  })

  it('reports degraded when the API returns 200 Degraded', async () => {
    fetchMock.mockResolvedValue(jsonResponse(healthReport('Degraded'), 200))
    const store = useHealthStore()

    await store.check()

    expect(store.state).toBe('degraded')
  })

  it('reports unhealthy (not offline) when the API returns 503 with a report', async () => {
    fetchMock.mockResolvedValue(jsonResponse(healthReport('Unhealthy'), 503))
    const store = useHealthStore()

    await store.check()

    expect(store.state).toBe('unhealthy')
    expect(store.report?.status).toBe('Unhealthy')
  })

  it('reports offline when the dev proxy cannot reach the API', async () => {
    fetchMock.mockResolvedValue(
      new Response('', { status: 502, headers: { 'Content-Type': 'text/plain' } }),
    )
    const store = useHealthStore()

    await store.check()

    expect(store.state).toBe('offline')
    expect(store.error).toBe('API unreachable (HTTP 502)')
    expect(store.latencyMs).toBeNull()
  })

  it('reports offline on a network error and keeps the last known report', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(healthReport('Healthy'), 200))
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const store = useHealthStore()

    await store.check()
    await store.check()

    expect(store.state).toBe('offline')
    expect(store.error).toBe('API unreachable (network error)')
    expect(store.report?.status).toBe('Healthy')
  })

  it('polls on an interval until stopped', async () => {
    vi.useFakeTimers()
    try {
      fetchMock.mockImplementation(async () => jsonResponse(healthReport('Healthy'), 200))
      const store = useHealthStore()

      store.startPolling(1_000)
      store.startPolling(1_000) // second call is a no-op
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1_000)
      expect(fetchMock).toHaveBeenCalledTimes(2)

      store.stopPolling()
      await vi.advanceTimersByTimeAsync(5_000)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

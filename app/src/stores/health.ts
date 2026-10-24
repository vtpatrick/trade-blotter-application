import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchHealth, type HealthResponse } from '@/api/health'

export type ApiConnectionState = 'connecting' | 'healthy' | 'degraded' | 'unhealthy' | 'offline'

const DEFAULT_POLL_INTERVAL_MS = 10_000

const STATE_BY_STATUS: Record<HealthResponse['status'], ApiConnectionState> = {
  Healthy: 'healthy',
  Degraded: 'degraded',
  Unhealthy: 'unhealthy',
}

/** App-wide API heartbeat. Start polling once (App.vue); read it anywhere. */
export const useHealthStore = defineStore('health', () => {
  const state = ref<ApiConnectionState>('connecting')
  const report = ref<HealthResponse | null>(null)
  const error = ref<string | null>(null)
  const latencyMs = ref<number | null>(null)
  const lastCheckedAt = ref<Date | null>(null)

  let timer: ReturnType<typeof setTimeout> | undefined
  let polling = false

  async function check() {
    const startedAt = performance.now()
    try {
      const result = await fetchHealth()
      report.value = result
      state.value = STATE_BY_STATUS[result.status] ?? 'unhealthy'
      latencyMs.value = Math.round(performance.now() - startedAt)
      error.value = null
    } catch (e) {
      state.value = 'offline'
      latencyMs.value = null
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      lastCheckedAt.value = new Date()
    }
  }

  /** Checks immediately, then every `intervalMs` after each check completes. */
  function startPolling(intervalMs = DEFAULT_POLL_INTERVAL_MS) {
    if (polling) return
    polling = true

    const tick = async () => {
      await check()
      if (polling) timer = setTimeout(tick, intervalMs)
    }
    void tick()
  }

  function stopPolling() {
    polling = false
    clearTimeout(timer)
    timer = undefined
  }

  return { state, report, error, latencyMs, lastCheckedAt, check, startPolling, stopPolling }
})

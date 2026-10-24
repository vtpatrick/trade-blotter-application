import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { fetchLiveQuotes, type LiveQuote } from '@/api/bloomberg'

export type LiveQuotesStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

/**
 * Live Bloomberg prices for a changing list of symbols (e.g. open positions), one batched
 * request per refresh. A new list aborts the request in flight; prices already shown stay
 * until fresh ones arrive, so the table does not blink when positions change.
 */
export function useLiveQuotes(symbols: () => string[], options: { refreshMs?: number } = {}) {
  const { refreshMs = 15_000 } = options

  const quotes = shallowRef<ReadonlyMap<string, LiveQuote>>(new Map())
  const status = ref<LiveQuotesStatus>('idle')
  const error = ref<string | null>(null)
  const updatedAt = ref<Date | null>(null)

  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  let inFlight: AbortController | undefined

  function cancel() {
    clearTimeout(refreshTimer)
    inFlight?.abort()
    inFlight = undefined
  }

  async function load(list: string[]) {
    inFlight?.abort()
    const request = new AbortController()
    inFlight = request

    try {
      const result = await fetchLiveQuotes(list, request.signal)
      if (request !== inFlight) return
      quotes.value = result
      status.value = 'ready'
      error.value = null
      updatedAt.value = new Date()
    } catch (e) {
      if (request !== inFlight) return
      status.value = 'unavailable'
      error.value = e instanceof Error ? e.message : String(e)
    }

    refreshTimer = setTimeout(() => load(list), refreshMs)
  }

  // Keyed on the sorted set, so re-fetched positions with the same symbols do not trigger a request.
  watch(
    () => [...new Set(symbols().map((s) => s.toUpperCase()))].sort().join(','),
    (key) => {
      cancel()
      if (!key) {
        quotes.value = new Map()
        status.value = 'idle'
        return
      }
      if (status.value !== 'ready') status.value = 'loading'
      void load(key.split(','))
    },
    { immediate: true },
  )

  onScopeDispose(cancel)

  return { quotes, status, error, updatedAt }
}

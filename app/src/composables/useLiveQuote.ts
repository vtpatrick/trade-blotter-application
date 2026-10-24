import { onScopeDispose, ref, watch } from 'vue'
import { fetchLiveQuote, type LiveQuote } from '@/api/bloomberg'
import { SYMBOL_PATTERN } from '@/utils/validateTrade'

export type LiveQuoteStatus = 'idle' | 'loading' | 'ready' | 'not-found' | 'unavailable'

export interface LiveQuoteOptions {
  /** Wait this long after the last keystroke before looking up. */
  debounceMs?: number
  /** Re-fetch the price this often while the symbol stays the same. */
  refreshMs?: number
}

/**
 * The live Bloomberg price for whatever symbol is being typed.
 *
 * Typing is debounced, so "A", "AA", "AAP", "AAPL" makes one lookup, for AAPL. Each new symbol
 * aborts the lookup in flight, and a response is only applied if it is for the newest request,
 * so a slow answer for an earlier symbol can never overwrite the current one.
 */
export function useLiveQuote(symbol: () => string, options: LiveQuoteOptions = {}) {
  const { debounceMs = 350, refreshMs = 15_000 } = options

  const quote = ref<LiveQuote | null>(null)
  const status = ref<LiveQuoteStatus>('idle')
  const error = ref<string | null>(null)

  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  let inFlight: AbortController | undefined

  function cancel() {
    clearTimeout(debounceTimer)
    clearTimeout(refreshTimer)
    inFlight?.abort()
    inFlight = undefined
  }

  async function load(target: string) {
    inFlight?.abort()
    const request = new AbortController()
    inFlight = request

    try {
      const result = await fetchLiveQuote(target, request.signal)
      if (request !== inFlight) return // superseded by a newer symbol
      quote.value = result
      status.value = result ? 'ready' : 'not-found'
      error.value = null
    } catch (e) {
      if (request !== inFlight) return
      quote.value = null
      status.value = 'unavailable'
      error.value = e instanceof Error ? e.message : String(e)
    }

    refreshTimer = setTimeout(() => load(target), refreshMs)
  }

  watch(
    () => symbol().trim().toUpperCase(),
    (target) => {
      cancel()
      // Never show the previous symbol's price under the new one, even for a moment.
      quote.value = null
      error.value = null
      if (!SYMBOL_PATTERN.test(target)) {
        status.value = 'idle'
        return
      }
      status.value = 'loading'
      debounceTimer = setTimeout(() => load(target), debounceMs)
    },
    { immediate: true },
  )

  onScopeDispose(cancel)

  return { quote, status, error }
}

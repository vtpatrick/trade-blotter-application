import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import {
  fetchCurrentTechnicals,
  fetchTechnicalsHistory,
  type DatedTechnicals,
  type Technicals,
} from '@/api/bloomberg'
import type { Trade } from '@/api/trades'
import { technicalColumns, technicalsOnDate, type TechnicalColumns } from '@/utils/technicals'

export type TechnicalsStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

/** The New York session a trade belongs to, as YYYY-MM-DD. */
const sessionDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
const today = () => sessionDate.format(new Date())

/**
 * Bloomberg technicals as they stood when each trade was booked, keyed by trade id.
 * One bdh request covers every symbol not yet loaded, from the earliest trade to today.
 */
export function useTradeTechnicals(trades: () => Trade[]) {
  const histories = shallowRef<ReadonlyMap<string, DatedTechnicals[]>>(new Map())
  const status = ref<TechnicalsStatus>('idle')
  const requested = new Set<string>()
  const controller = new AbortController()
  onScopeDispose(() => controller.abort())

  async function load(symbols: string[], from: string) {
    symbols.forEach((s) => requested.add(s))
    status.value = 'loading'
    try {
      const loaded = await fetchTechnicalsHistory(symbols, from, today(), controller.signal)
      histories.value = new Map([...histories.value, ...loaded])
      status.value = 'ready'
    } catch {
      if (controller.signal.aborted) return
      symbols.forEach((s) => requested.delete(s)) // retried when the trades next change
      status.value = 'unavailable'
    }
  }

  watch(
    trades,
    (list) => {
      const missing = [...new Set(list.map((t) => t.symbol))].filter((s) => !requested.has(s))
      if (missing.length === 0) return
      const earliest = list.reduce(
        (min, t) => (t.timestamp < min ? t.timestamp : min),
        list[0]!.timestamp,
      )
      void load(missing, sessionDate.format(new Date(earliest)))
    },
    { immediate: true },
  )

  const byTrade = computed(() => {
    const map = new Map<number, TechnicalColumns>()
    for (const t of trades()) {
      const history = histories.value.get(t.symbol)
      if (!history) continue
      map.set(
        t.id,
        technicalColumns(
          t.price,
          technicalsOnDate(history, sessionDate.format(new Date(t.timestamp))),
        ),
      )
    }
    return map
  })

  return { byTrade, status }
}

/** Current Bloomberg technicals for a changing set of symbols, refreshed every few minutes. */
export function useCurrentTechnicals(symbols: () => string[], refreshMs = 5 * 60_000) {
  const technicals = shallowRef<ReadonlyMap<string, Technicals>>(new Map())
  const status = ref<TechnicalsStatus>('idle')
  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight: AbortController | undefined

  async function load(list: string[]) {
    clearTimeout(timer)
    inFlight?.abort()
    const request = new AbortController()
    inFlight = request
    try {
      technicals.value = await fetchCurrentTechnicals(list, request.signal)
      status.value = 'ready'
    } catch {
      if (request.signal.aborted) return
      status.value = 'unavailable'
    }
    if (inFlight === request) timer = setTimeout(() => load(list), refreshMs)
  }

  watch(
    () => [...new Set(symbols())].sort().join(','),
    (key) => {
      if (!key) return
      if (status.value === 'idle') status.value = 'loading'
      void load(key.split(','))
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    clearTimeout(timer)
    inFlight?.abort()
  })

  return { technicals, status }
}

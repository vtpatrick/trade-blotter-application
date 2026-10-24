import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { HubConnectionState, type HubConnection } from '@microsoft/signalr'
import {
  createTrade,
  fetchPositions,
  fetchTrades,
  type NewTrade,
  type Position,
  type Trade,
} from '@/api/trades'
import { createTradesConnection } from '@/api/tradesHub'

export type LiveFeedState = 'connecting' | 'live' | 'reconnecting' | 'offline'

const RECONNECT_DELAY_MS = 5_000
const NEW_TRADE_HIGHLIGHT_MS = 2_500

const newestFirst = (a: Trade, b: Trade) =>
  Date.parse(b.timestamp) - Date.parse(a.timestamp) || b.id - a.id

/**
 * Trades, positions and the live feed. Trades arrive from three places: the initial
 * load, this browser's own submissions, and SignalR broadcasts (which include this
 * browser's submissions too), so every path goes through upsertTrade to stay de-duplicated.
 */
export const useBlotterStore = defineStore('blotter', () => {
  const trades = ref<Trade[]>([])
  const positions = ref<Position[]>([])
  const loading = ref(false)
  const loadError = ref<string | null>(null)
  const liveState = ref<LiveFeedState>('connecting')
  /** Trades that arrived after the initial load, briefly highlighted in the blotter. */
  const newTradeIds = ref(new Set<number>())

  const tradeCount = computed(() => trades.value.length)

  let connection: HubConnection | undefined
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let positionsRequest = 0

  function upsertTrade(trade: Trade, highlight: boolean) {
    if (trades.value.some((t) => t.id === trade.id)) return

    trades.value = [...trades.value, trade].sort(newestFirst)
    if (highlight) {
      newTradeIds.value.add(trade.id)
      setTimeout(() => newTradeIds.value.delete(trade.id), NEW_TRADE_HIGHLIGHT_MS)
    }
  }

  /** Positions are derived on the server; re-fetch after any trade. Late responses are ignored. */
  async function refreshPositions() {
    const request = ++positionsRequest
    const latest = await fetchPositions()
    if (request === positionsRequest) positions.value = latest
  }

  async function load() {
    loading.value = true
    try {
      const [loadedTrades] = await Promise.all([fetchTrades(), refreshPositions()])
      // Merge rather than replace: a trade booked while this request was in flight stays visible.
      const loadedIds = new Set(loadedTrades.map((t) => t.id))
      const inFlight = trades.value.filter((t) => !loadedIds.has(t.id))
      trades.value = [...loadedTrades, ...inFlight].sort(newestFirst)
      loadError.value = null
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function submitTrade(trade: NewTrade): Promise<Trade> {
    const booked = await createTrade(trade)
    // Show it immediately rather than waiting for the broadcast (which may be down).
    upsertTrade(booked, true)
    void refreshPositions().catch(() => {})
    return booked
  }

  function onTradeAdded(trade: Trade) {
    upsertTrade(trade, true)
    void refreshPositions().catch(() => {})
  }

  async function connect() {
    clearTimeout(reconnectTimer)
    if (!connection) {
      connection = createTradesConnection({ tradeAdded: onTradeAdded })
      connection.onreconnecting(() => (liveState.value = 'reconnecting'))
      // Missed broadcasts while disconnected: reload everything.
      connection.onreconnected(() => {
        liveState.value = 'live'
        void load()
      })
      // Automatic reconnect gave up: keep retrying on our own schedule.
      connection.onclose(() => {
        if (!connection) return
        liveState.value = 'offline'
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
      })
    }

    if (connection.state !== HubConnectionState.Disconnected) return

    liveState.value = 'connecting'
    try {
      await connection.start()
      liveState.value = 'live'
    } catch {
      // API not reachable yet (initial start is not covered by automatic reconnect).
      liveState.value = 'offline'
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
    }
    // Load on every attempt: fills the blotter on success, surfaces the error otherwise.
    await load()
  }

  /** Open the live feed and load data. Call once from the app shell. */
  function start() {
    void connect()
  }

  async function stop() {
    clearTimeout(reconnectTimer)
    const closing = connection
    connection = undefined
    await closing?.stop()
  }

  return {
    trades,
    positions,
    loading,
    loadError,
    liveState,
    newTradeIds,
    tradeCount,
    load,
    submitTrade,
    start,
    stop,
  }
})

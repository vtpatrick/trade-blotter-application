import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { NewTrade, Position, Trade } from '@/api/trades'
import { useBlotterStore } from '../blotter'

const api = vi.hoisted(() => ({
  fetchTrades: vi.fn<() => Promise<Trade[]>>(),
  fetchPositions: vi.fn<() => Promise<Position[]>>(),
  createTrade: vi.fn<(trade: NewTrade) => Promise<Trade>>(),
}))
vi.mock('@/api/trades', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/trades')>()),
  ...api,
}))

// Capture the handlers the store registers so tests can play the server's broadcasts.
const hub = vi.hoisted(() => ({ tradeAdded: undefined as ((t: Trade) => void) | undefined }))
vi.mock('@/api/tradesHub', () => ({
  createTradesConnection: (handlers: { tradeAdded: (t: Trade) => void }) => {
    hub.tradeAdded = handlers.tradeAdded
    return {
      state: 'Disconnected',
      start: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      stop: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      onreconnecting: vi.fn<(callback: () => void) => void>(),
      onreconnected: vi.fn<(callback: () => void) => void>(),
      onclose: vi.fn<(callback: () => void) => void>(),
    }
  },
}))

function trade(id: number, minute: number, symbol = 'AAPL'): Trade {
  return {
    id,
    symbol,
    side: 'Buy',
    quantity: 10,
    price: 100,
    notional: 1000,
    timestamp: new Date(Date.UTC(2026, 9, 24, 14, minute)).toISOString(),
  }
}

const aaplPosition: Position = { symbol: 'AAPL', netQuantity: 10, averageCost: 100 }

describe('blotter store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    api.fetchTrades.mockResolvedValue([])
    api.fetchPositions.mockResolvedValue([])
  })

  it('loads trades newest first along with positions', async () => {
    api.fetchTrades.mockResolvedValue([trade(1, 0), trade(2, 5), trade(3, 2)])
    api.fetchPositions.mockResolvedValue([aaplPosition])
    const store = useBlotterStore()

    await store.load()

    expect(store.trades.map((t) => t.id)).toEqual([2, 3, 1])
    expect(store.positions).toEqual([aaplPosition])
    expect(store.loadError).toBeNull()
  })

  it('shows a submitted trade once even though the broadcast echoes it back', async () => {
    const booked = trade(7, 10)
    api.createTrade.mockResolvedValue(booked)
    api.fetchPositions.mockResolvedValue([aaplPosition])
    const store = useBlotterStore()
    store.start()
    await vi.waitFor(() => expect(hub.tradeAdded).toBeDefined())

    await store.submitTrade({ symbol: 'AAPL', side: 'Buy', quantity: 10, price: 100 })
    hub.tradeAdded!(booked)

    expect(store.trades.filter((t) => t.id === 7)).toHaveLength(1)
    expect(store.newTradeIds.has(7)).toBe(true)
    await vi.waitFor(() => expect(store.positions).toEqual([aaplPosition]))
  })

  it('adds trades broadcast by other users in time order and refreshes positions', async () => {
    api.fetchTrades.mockResolvedValue([trade(1, 0)])
    const store = useBlotterStore()
    store.start()
    await vi.waitFor(() => expect(store.trades).toHaveLength(1))
    api.fetchPositions.mockResolvedValue([aaplPosition])

    hub.tradeAdded!(trade(2, 30, 'MSFT'))

    expect(store.trades.map((t) => t.id)).toEqual([2, 1])
    await vi.waitFor(() => expect(store.positions).toEqual([aaplPosition]))
  })

  it('reports a load failure', async () => {
    api.fetchTrades.mockRejectedValue(new Error('GET /api/trades failed (HTTP 502)'))
    const store = useBlotterStore()

    await store.load()

    expect(store.loadError).toBe('GET /api/trades failed (HTTP 502)')
    expect(store.loading).toBe(false)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import type { LiveQuote } from '@/api/bloomberg'
import { useLiveQuote } from '../useLiveQuote'

const bloomberg = vi.hoisted(() => ({
  fetchLiveQuote: vi.fn<(symbol: string, signal?: AbortSignal) => Promise<LiveQuote | null>>(),
}))
vi.mock('@/api/bloomberg', () => bloomberg)

const quoteFor = (symbol: string, last: number): LiveQuote => ({
  symbol,
  name: `${symbol} INC`,
  last,
  changePercent: 0.5,
  asOf: '2026-10-24T13:35:16Z',
})

describe('useLiveQuote', () => {
  // A fresh scope per test: a stopped scope cannot run again.
  let scope: EffectScope

  beforeEach(() => {
    vi.useFakeTimers()
    scope = effectScope()
  })
  afterEach(() => {
    scope.stop()
    bloomberg.fetchLiveQuote.mockReset()
    vi.useRealTimers()
  })

  function setup() {
    const symbol = ref('')
    const live = scope.run(() =>
      useLiveQuote(() => symbol.value, { debounceMs: 300, refreshMs: 15_000 }),
    )!
    return { symbol, ...live }
  }

  async function type(symbol: { value: string }, text: string) {
    for (let i = 1; i <= text.length; i++) {
      symbol.value = text.slice(0, i)
      await nextTick()
      await vi.advanceTimersByTimeAsync(100) // faster than the debounce
    }
  }

  it('looks up once, for the finished symbol, after typing pauses', async () => {
    bloomberg.fetchLiveQuote.mockImplementation(async (s) => quoteFor(s, 100))
    const live = setup()

    await type(live.symbol, 'aapl')
    expect(live.status.value).toBe('loading')
    expect(bloomberg.fetchLiveQuote).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)

    expect(bloomberg.fetchLiveQuote).toHaveBeenCalledTimes(1)
    expect(bloomberg.fetchLiveQuote.mock.calls[0]![0]).toBe('AAPL')
    expect(live.status.value).toBe('ready')
    expect(live.quote.value?.last).toBe(100)
  })

  it('ignores a slow answer for a symbol that has since changed', async () => {
    let resolveOld: (q: LiveQuote) => void = () => {}
    bloomberg.fetchLiveQuote
      .mockImplementationOnce(() => new Promise((resolve) => (resolveOld = resolve)))
      .mockImplementationOnce(async () => quoteFor('MSFT', 400))
    const live = setup()

    live.symbol.value = 'AAPL'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300) // AAPL request goes out and hangs
    const oldSignal = bloomberg.fetchLiveQuote.mock.calls[0]![1]!

    live.symbol.value = 'MSFT'
    await nextTick()
    expect(oldSignal.aborted).toBe(true)
    expect(live.quote.value).toBeNull() // AAPL's price is never shown under MSFT

    await vi.advanceTimersByTimeAsync(300)
    resolveOld(quoteFor('AAPL', 100)) // the stale answer arrives last
    await vi.advanceTimersByTimeAsync(0)

    expect(live.quote.value?.symbol).toBe('MSFT')
    expect(live.quote.value?.last).toBe(400)
  })

  it('reports an unknown ticker as not found', async () => {
    bloomberg.fetchLiveQuote.mockResolvedValue(null)
    const live = setup()

    live.symbol.value = 'ZZQXQ'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)

    expect(live.status.value).toBe('not-found')
  })

  it('reports unavailable when DeskLink fails', async () => {
    bloomberg.fetchLiveQuote.mockRejectedValue(
      new Error('DeskLink is not reachable from this page'),
    )
    const live = setup()

    live.symbol.value = 'AAPL'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)

    expect(live.status.value).toBe('unavailable')
    expect(live.error.value).toBe('DeskLink is not reachable from this page')
  })

  it('does not look up incomplete or invalid input, and clears when the field empties', async () => {
    bloomberg.fetchLiveQuote.mockImplementation(async (s) => quoteFor(s, 100))
    const live = setup()

    live.symbol.value = '1A'
    await nextTick()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(live.status.value).toBe('idle')

    live.symbol.value = 'KO'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    live.symbol.value = ''
    await nextTick()

    expect(bloomberg.fetchLiveQuote).toHaveBeenCalledTimes(1)
    expect(live.status.value).toBe('idle')
    expect(live.quote.value).toBeNull()
  })

  it('refreshes the price while the symbol stays the same', async () => {
    bloomberg.fetchLiveQuote
      .mockImplementationOnce(async () => quoteFor('KO', 92.71))
      .mockImplementationOnce(async () => quoteFor('KO', 92.9))
    const live = setup()

    live.symbol.value = 'KO'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    expect(live.quote.value?.last).toBe(92.71)

    await vi.advanceTimersByTimeAsync(15_000)
    expect(live.quote.value?.last).toBe(92.9)
  })
})

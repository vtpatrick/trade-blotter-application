import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Trade } from '@/api/trades'
import { useBlotterStore } from '@/stores/blotter'
import BlotterTable from '../BlotterTable.vue'
import type { DatedTechnicals } from '@/api/bloomberg'

// Technicals at trade time come from Bloomberg (bdh); never call DeskLink from tests.
const bloomberg = vi.hoisted(() => ({
  fetchTechnicalsHistory:
    vi.fn<
      (symbols: string[], from: string, to: string) => Promise<Map<string, DatedTechnicals[]>>
    >(),
}))
vi.mock('@/api/bloomberg', () => bloomberg)

function trade(id: number, symbol: string, side: Trade['side'], minute: number): Trade {
  return {
    id,
    symbol,
    side,
    quantity: 10,
    price: 1,
    notional: 10,
    timestamp: new Date(Date.UTC(2026, 9, 24, 14, minute)).toISOString(),
  }
}

describe('BlotterTable (AG Grid)', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    bloomberg.fetchTechnicalsHistory.mockReset()
    bloomberg.fetchTechnicalsHistory.mockResolvedValue(new Map())
    setActivePinia(createPinia())
    useBlotterStore().trades = [
      trade(1, 'MSFT', 'Buy', 0),
      trade(2, 'AAPL', 'Sell', 5),
      trade(3, 'TSLA', 'Buy', 2),
    ]
  })

  afterEach(() => wrapper?.unmount())

  async function mountGrid() {
    wrapper = mount(BlotterTable, { attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  /** Symbols of the displayed rows, top to bottom. */
  const symbols = (w: VueWrapper) =>
    w
      .findAll('.ag-row')
      .sort((a, b) => Number(a.attributes('row-index')) - Number(b.attributes('row-index')))
      .map((row) => row.find('[col-id="symbol"]').text())

  async function filter(w: VueWrapper, column: string, expression: string) {
    await w.find(`input[aria-label="Filter ${column}"]`).setValue(expression)
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  it('shows newest trades first by default', async () => {
    const w = await mountGrid()

    expect(symbols(w)).toEqual(['AAPL', 'TSLA', 'MSFT'])
  })

  it('sorts by a column on header click, and reverses on a second click', async () => {
    const w = await mountGrid()
    const header = () => w.find('.ag-header-cell[col-id="symbol"] .ag-header-cell-label')

    await header().trigger('click')
    await flushPromises()
    expect(symbols(w)).toEqual(['AAPL', 'MSFT', 'TSLA'])

    await header().trigger('click')
    await flushPromises()
    expect(symbols(w)).toEqual(['TSLA', 'MSFT', 'AAPL'])
  })

  it('marks each row edge and badge with its side', async () => {
    const w = await mountGrid()
    const row = (index: number) => w.find(`.ag-row[row-index="${index}"]`)

    expect(row(0).classes()).toContain('edge-sell')
    expect(row(0).find('.side-badge').text()).toBe('Sell')
    expect(row(1).classes()).toContain('edge-buy')
  })

  it('filters with expressions typed under the headers, combined across columns', async () => {
    const w = await mountGrid()

    await filter(w, 'Side', '=buy')
    expect(symbols(w)).toEqual(['TSLA', 'MSFT'])
    expect(w.find('.count').text()).toContain('2 of 3 trades')

    await filter(w, 'Symbol', 'ms|aapl')
    expect(symbols(w)).toEqual(['MSFT'])

    await w.find('.filter-clear').trigger('click')
    await flushPromises()
    expect(symbols(w)).toEqual(['AAPL', 'TSLA', 'MSFT'])
    expect((w.find('input[aria-label="Filter Symbol"]').element as HTMLInputElement).value).toBe('')
  })

  it('takes number and date expressions', async () => {
    useBlotterStore().trades = [
      { ...trade(1, 'OLD', 'Buy', 0), quantity: 5, timestamp: '2025-12-15T15:00:00Z' },
      { ...trade(2, 'MID', 'Sell', 0), quantity: 6, timestamp: '2026-06-15T15:00:00Z' },
      { ...trade(3, 'NEW', 'Buy', 0), quantity: 500, timestamp: '2026-09-15T15:00:00Z' },
    ]
    const w = await mountGrid()

    await filter(w, 'Quantity', '5|6')
    expect(symbols(w)).toEqual(['MID', 'OLD'])

    await filter(w, 'Quantity', '>5')
    expect(symbols(w)).toEqual(['NEW', 'MID'])

    await filter(w, 'Quantity', '')
    await filter(w, 'Time', '<2026')
    expect(symbols(w)).toEqual(['OLD'])
  })

  it('marks an invalid expression and ignores it instead of emptying the grid', async () => {
    const w = await mountGrid()

    await filter(w, 'Price', '>')
    const input = w.find('input[aria-label="Filter Price"]')

    expect(input.classes()).toContain('invalid')
    expect(input.attributes('title')).toBe('">" needs a value after it')
    expect(symbols(w)).toEqual(['AAPL', 'TSLA', 'MSFT'])
  })

  it('keeps the Bloomberg technicals columns hidden', async () => {
    const w = await mountGrid()

    expect(w.find('.ag-header-cell[col-id="rsi14"]').exists()).toBe(false)
    expect(w.find('.ag-header-cell[col-id="spacer"]').exists()).toBe(false)
  })
})

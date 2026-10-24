import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { LiveQuote, PricePoint, SecurityProfile, Technicals } from '@/api/bloomberg'
import { useBlotterStore } from '@/stores/blotter'
import PositionsView from '../PositionsView.vue'

const bloomberg = vi.hoisted(() => ({
  fetchLiveQuotes: vi.fn<(symbols: string[]) => Promise<Map<string, LiveQuote>>>(),
  fetchSecurityProfile: vi.fn<(symbol: string) => Promise<SecurityProfile | null>>(),
  fetchPriceHistory: vi.fn<(symbol: string) => Promise<PricePoint[]>>(),
  fetchCurrentTechnicals: vi.fn<(symbols: string[]) => Promise<Map<string, Technicals>>>(),
}))
vi.mock('@/api/bloomberg', () => bloomberg)

const quote = (symbol: string, last: number): LiveQuote => ({
  symbol,
  name: `${symbol} CORP`,
  last,
  changePercent: null,
  asOf: '2026-10-24T13:35:16Z',
})

describe('PositionsView (AG Grid)', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    setActivePinia(createPinia())
    useBlotterStore().positions = [
      { symbol: 'KO', netQuantity: -100, averageCost: 90 }, // short, price fell: gainer
      { symbol: 'PEP', netQuantity: 100, averageCost: 140 }, // long, price fell: loser
      { symbol: 'WMT', netQuantity: 50, averageCost: 100 }, // long, price rose: gainer
    ]
    bloomberg.fetchLiveQuotes.mockResolvedValue(
      new Map([
        ['KO', quote('KO', 85)],
        ['PEP', quote('PEP', 130)],
        ['WMT', quote('WMT', 110)],
      ]),
    )
    bloomberg.fetchSecurityProfile.mockResolvedValue(null)
    bloomberg.fetchPriceHistory.mockResolvedValue([])
    bloomberg.fetchCurrentTechnicals.mockResolvedValue(
      new Map([['WMT', { rsi14: 64.2, ma50: 100, ma200: 88, vol30: 18.5 }]]),
    )
  })

  afterEach(() => wrapper?.unmount())

  /** Let Vue and the grid apply a change (the grid renders row changes asynchronously). */
  async function settle() {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 20))
  }

  async function mountGrid() {
    wrapper = mount(PositionsView, { attachTo: document.body })
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve)) // the recount after prices arrive
    return wrapper
  }

  /** Symbols of the displayed position rows (not detail or pinned totals rows), top to bottom. */
  const symbols = (w: VueWrapper) =>
    w
      .findAll('.ag-row')
      .filter(
        (row) =>
          !row.classes().includes('ag-full-width-row') && !row.classes().includes('ag-row-pinned'),
      )
      .sort((a, b) => Number(a.attributes('row-index')) - Number(b.attributes('row-index')))
      .map((row) => row.find('[col-id="symbol"]').text())

  async function filter(w: VueWrapper, column: string, expression: string) {
    await w.find(`input[aria-label="Filter ${column}"]`).setValue(expression)
    await flushPromises()
  }

  it('lists positions marked to the live price, with a totals row', async () => {
    const w = await mountGrid()

    expect(symbols(w)).toEqual(['KO', 'PEP', 'WMT'])
    // Unrealized: KO +500, PEP −1,000, WMT +500
    expect(w.find('.ag-row-pinned').text()).toContain('0.00')
  })

  it('filters with expressions, and the totals and summary follow the filter', async () => {
    const w = await mountGrid()

    await filter(w, 'Net qty', '>0')
    expect(symbols(w)).toEqual(['PEP', 'WMT'])

    await filter(w, 'Unrl P&L', '>0')
    expect(symbols(w)).toEqual(['WMT'])
    expect(w.find('.filter-count').text()).toContain('Showing 1 of 3')
    expect(w.find('.ag-row-pinned').text()).toContain('+500.00') // WMT: (110 − 100) × 50
    expect(w.find('.summary').text()).toContain('+500.00')

    await w.find('.filter-clear').trigger('click')
    await flushPromises()
    expect(symbols(w)).toEqual(['KO', 'PEP', 'WMT'])
  })

  it('filters text columns with or', async () => {
    const w = await mountGrid()

    await filter(w, 'Name', 'pep corp|wmt')
    expect(symbols(w)).toEqual(['PEP', 'WMT'])
  })

  it('expands a row into a full-width detail row and collapses it again', async () => {
    const w = await mountGrid()
    const koCell = () => w.findAll('.ag-row [col-id="symbol"]').find((c) => c.text() === 'KO')!

    await koCell().trigger('click')
    await settle()
    expect(w.findAll('.ag-full-width-row')).toHaveLength(1)
    expect(bloomberg.fetchSecurityProfile).toHaveBeenCalledWith('KO', expect.anything())
    expect(bloomberg.fetchPriceHistory).toHaveBeenCalledWith('KO')

    await koCell().trigger('click')
    await settle()
    expect(w.findAll('.ag-full-width-row')).toHaveLength(0)
  })

  it('keeps the Bloomberg technicals columns hidden', async () => {
    const w = await mountGrid()

    expect(w.find('.ag-header-cell[col-id="rsi14"]').exists()).toBe(false)
  })
})

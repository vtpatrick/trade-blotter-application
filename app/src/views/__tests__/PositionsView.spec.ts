import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { LiveQuote, PricePoint, SecurityProfile } from '@/api/bloomberg'
import { useBlotterStore } from '@/stores/blotter'
import PositionsView from '../PositionsView.vue'

const bloomberg = vi.hoisted(() => ({
  fetchLiveQuotes: vi.fn<(symbols: string[]) => Promise<Map<string, LiveQuote>>>(),
  fetchSecurityProfile: vi.fn<(symbol: string) => Promise<SecurityProfile | null>>(),
  fetchPriceHistory: vi.fn<(symbol: string) => Promise<PricePoint[]>>(),
}))
vi.mock('@/api/bloomberg', () => bloomberg)

const quote = (symbol: string, last: number): LiveQuote => ({
  symbol,
  name: `${symbol} CORP`,
  last,
  changePercent: null,
  asOf: '2026-10-24T13:35:16Z',
})

describe('PositionsView', () => {
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
  })

  const symbols = (wrapper: ReturnType<typeof mount>) =>
    wrapper.findAll('tr.position-row .symbol').map((td) => td.text())
  const chip = (wrapper: ReturnType<typeof mount>, label: string) =>
    wrapper.findAll('.quick-filter button').find((b) => b.text() === label)!

  it('filters by direction and P&L, and the totals follow the filter', async () => {
    const wrapper = mount(PositionsView)
    await flushPromises()
    expect(symbols(wrapper)).toEqual(['KO', 'PEP', 'WMT'])

    await chip(wrapper, 'Long').trigger('click')
    expect(symbols(wrapper)).toEqual(['PEP', 'WMT'])

    await chip(wrapper, 'Gainers').trigger('click')
    expect(symbols(wrapper)).toEqual(['WMT'])
    expect(wrapper.find('.filter-count').text()).toContain('Showing 1 of 3')
    expect(wrapper.find('tfoot').text()).toContain('+500.00') // WMT only: (110 − 100) × 50

    await wrapper.find('.filter-clear').trigger('click')
    expect(symbols(wrapper)).toEqual(['KO', 'PEP', 'WMT'])
  })

  it('searches by symbol or name', async () => {
    const wrapper = mount(PositionsView)
    await flushPromises()

    await wrapper.find('.filter-search').setValue('pep corp')
    expect(symbols(wrapper)).toEqual(['PEP'])
  })

  it('expands a row into its detail panel and collapses it again', async () => {
    const wrapper = mount(PositionsView)
    await flushPromises()
    const toggle = wrapper.find('tr.position-row button.expand')

    await toggle.trigger('click')
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('.detail-row').exists()).toBe(true)
    expect(bloomberg.fetchSecurityProfile).toHaveBeenCalledWith('KO', expect.anything())
    expect(bloomberg.fetchPriceHistory).toHaveBeenCalledWith('KO')

    await toggle.trigger('click')
    expect(wrapper.find('.detail-row').exists()).toBe(false)
  })
})

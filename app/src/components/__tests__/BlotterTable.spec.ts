import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Trade } from '@/api/trades'
import { useBlotterStore } from '@/stores/blotter'
import BlotterTable from '../BlotterTable.vue'

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

describe('BlotterTable', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useBlotterStore().trades = [
      trade(1, 'MSFT', 'Buy', 0),
      trade(2, 'AAPL', 'Sell', 5),
      trade(3, 'TSLA', 'Buy', 2),
    ]
  })

  const symbols = (wrapper: ReturnType<typeof mount>) =>
    wrapper.findAll('tbody td.symbol').map((td) => td.text())

  it('shows newest trades first by default', () => {
    const wrapper = mount(BlotterTable)

    expect(symbols(wrapper)).toEqual(['AAPL', 'TSLA', 'MSFT'])
    expect(wrapper.find('th[aria-sort="descending"]').text()).toContain('Time')
  })

  it('sorts by a column on click and reverses on a second click', async () => {
    const wrapper = mount(BlotterTable)
    const symbolHeader = wrapper.findAll('th button').find((b) => b.text().startsWith('Symbol'))!

    await symbolHeader.trigger('click')
    expect(symbols(wrapper)).toEqual(['AAPL', 'MSFT', 'TSLA'])

    await symbolHeader.trigger('click')
    expect(symbols(wrapper)).toEqual(['TSLA', 'MSFT', 'AAPL'])
  })

  it('marks each row and badge with its side', () => {
    const wrapper = mount(BlotterTable)
    const rows = wrapper.findAll('tbody tr')

    expect(rows[0]!.classes()).toContain('sell')
    expect(rows[0]!.find('.side-badge').text()).toBe('Sell')
    expect(rows[1]!.classes()).toContain('buy')
  })

  it('filters by symbol and side, and says how many are shown', async () => {
    const wrapper = mount(BlotterTable)
    const chip = (label: string) =>
      wrapper.findAll('.quick-filter button').find((b) => b.text() === label)!

    await chip('Buy').trigger('click')
    expect(symbols(wrapper)).toEqual(['TSLA', 'MSFT'])
    expect(wrapper.find('.count').text()).toContain('2 of 3 trades')

    await wrapper.find('.filter-search').setValue('ms')
    expect(symbols(wrapper)).toEqual(['MSFT'])

    await wrapper.find('.filter-clear').trigger('click')
    expect(symbols(wrapper)).toEqual(['AAPL', 'TSLA', 'MSFT'])
  })

  it('filters by period', async () => {
    useBlotterStore().trades = [
      { ...trade(1, 'OLD', 'Buy', 0), timestamp: '2020-01-15T15:00:00Z' },
      { ...trade(2, 'NOW', 'Sell', 0), timestamp: new Date().toISOString() },
    ]
    const wrapper = mount(BlotterTable)

    await wrapper
      .findAll('.quick-filter button')
      .find((b) => b.text() === 'Today')!
      .trigger('click')

    expect(symbols(wrapper)).toEqual(['NOW'])
  })
})

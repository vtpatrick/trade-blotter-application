import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Trade } from '@/api/trades'
import { useBlotterStore } from '@/stores/blotter'
import PositionDetail from '../PositionDetail.vue'

vi.mock('@/api/bloomberg', () => ({
  fetchSecurityProfile: async () => null,
  fetchPriceHistory: async () => [],
}))

const trade = (
  id: number,
  symbol: string,
  side: Trade['side'],
  quantity: number,
  day: number,
): Trade => ({
  id,
  symbol,
  side,
  quantity,
  price: 10 + id,
  notional: quantity * (10 + id),
  timestamp: new Date(Date.UTC(2026, 8, day, 20)).toISOString(),
})

describe('PositionDetail trade history', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useBlotterStore().trades = [
      trade(1, 'KO', 'Buy', 100, 1),
      trade(2, 'PEP', 'Buy', 999, 2), // another symbol: not shown
      trade(3, 'KO', 'Sell', 100, 3), // flat
      trade(4, 'KO', 'Sell', 50, 4), // short 50
    ]
  })

  it('lists this symbol’s trades newest first with the position each one left', async () => {
    const wrapper = mount(PositionDetail, { props: { symbol: 'KO', averageCost: 14, last: 15 } })
    await flushPromises()

    const rows = wrapper
      .findAll('.trades tbody tr')
      .map((tr) => tr.findAll('td').map((td) => td.text()))

    expect(wrapper.find('.trades .panel-title').text()).toContain('3')
    expect(rows.map((r) => [r[1], r[2], r[4]])).toEqual([
      ['Sell', '50', '-50'],
      ['Sell', '100', 'flat'],
      ['Buy', '100', '100'],
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { PricePoint } from '@/api/bloomberg'
import PriceHistoryChart from '../PriceHistoryChart.vue'

/** One close per weekday from `from`, rising by 1 a day from 100. */
function series(from: string, days: number): PricePoint[] {
  const points: PricePoint[] = []
  const d = new Date(`${from}T00:00:00Z`)
  while (points.length < days) {
    if (d.getUTCDay() % 6 !== 0) {
      points.push({ date: d.toISOString().slice(0, 10), close: 100 + points.length })
    }
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return points
}

const points = series('2021-10-25', 1300) // a little over five years

function mountChart(
  trades = [] as { date: string; side: 'Buy' | 'Sell'; quantity: number; price: number }[],
) {
  return mount(PriceHistoryChart, {
    props: { symbol: 'KO', points, averageCost: 1200, trades },
  })
}

describe('PriceHistoryChart', () => {
  it('shows one year by default and widens to five', async () => {
    const wrapper = mountChart()
    const oneYear = wrapper.find('.summary').text()

    await wrapper
      .findAll('.ranges button')
      .find((b) => b.text() === '5Y')!
      .trigger('click')
    const fiveYears = wrapper.find('.summary').text()

    expect(wrapper.find('.ranges button[aria-pressed="true"]').text()).toBe('5Y')
    expect(oneYear).not.toEqual(fiveYears)
    // The 5Y window starts five years before the last close.
    const last = points[points.length - 1]!.date
    expect(fiveYears).toContain(String(Number(last.slice(0, 4)) - 5))
  })

  it('draws the average cost line and a ▲/▼ marker per trade in range', () => {
    const inRange = points[points.length - 10]!.date
    const outOfRange = points[0]!.date // older than the default 1Y window
    const wrapper = mountChart([
      { date: inRange, side: 'Buy', quantity: 10, price: 1290 },
      { date: inRange, side: 'Sell', quantity: 5, price: 1291 },
      { date: outOfRange, side: 'Buy', quantity: 1, price: 100 },
    ])

    expect(wrapper.find('.avg text').text()).toContain('1,200.00')
    expect(wrapper.findAll('.marker.buy')).toHaveLength(1)
    expect(wrapper.findAll('.marker.sell')).toHaveLength(1)
  })

  it('reads values with the keyboard, including the trades on that day', async () => {
    const last = points[points.length - 1]!
    const wrapper = mountChart([{ date: last.date, side: 'Sell', quantity: 7, price: 1399 }])
    const frame = wrapper.find('.frame')

    await frame.trigger('keydown', { key: 'End' })
    expect(wrapper.find('.tooltip').text()).toContain(
      last.close.toLocaleString(undefined, { minimumFractionDigits: 2 }),
    )
    expect(wrapper.find('.tooltip').text()).toContain('Sell 7')

    await frame.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.find('.tooltip').text()).not.toContain('Sell 7')

    await frame.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.tooltip').exists()).toBe(false)
  })
})

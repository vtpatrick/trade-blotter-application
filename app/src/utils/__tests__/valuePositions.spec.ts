import { describe, expect, it } from 'vitest'
import type { LiveQuote } from '@/api/bloomberg'
import { valuePositions } from '../valuePositions'

const quote = (symbol: string, last: number, changePercent: number | null): LiveQuote => ({
  symbol,
  name: `${symbol} INC`,
  last,
  changePercent,
  asOf: '2026-10-24T13:35:16Z',
})

describe('valuePositions', () => {
  it('marks a long: gains when the price rises', () => {
    const { rows } = valuePositions(
      [{ symbol: 'PEP', netQuantity: 100, averageCost: 130 }],
      new Map([['PEP', quote('PEP', 135, 2.5)]]),
    )

    expect(rows[0]).toMatchObject({
      costBasis: 13_000,
      marketValue: 13_500,
      unrealizedPnl: 500,
      name: 'PEP INC',
    })
    expect(rows[0]!.unrealizedPercent).toBeCloseTo(3.846, 3)
  })

  it('marks a short: gains when the price falls', () => {
    const { rows } = valuePositions(
      [{ symbol: 'KO', netQuantity: -200, averageCost: 90 }],
      new Map([['KO', quote('KO', 85, -1)]]),
    )

    expect(rows[0]).toMatchObject({
      costBasis: -18_000,
      marketValue: -17_000,
      unrealizedPnl: 1_000,
    })
    expect(rows[0]!.unrealizedPercent).toBeCloseTo(5.556, 3)
  })

  it('derives day P&L from the day change: shares × (last − previous close)', () => {
    // Up 10% to 110 means the previous close was 100: +10 a share on 50 shares, −10 on a 30-share short.
    const { rows, totals } = valuePositions(
      [
        { symbol: 'A', netQuantity: 50, averageCost: 100 },
        { symbol: 'B', netQuantity: -30, averageCost: 100 },
      ],
      new Map([
        ['A', quote('A', 110, 10)],
        ['B', quote('B', 110, 10)],
      ]),
    )

    expect(rows[0]!.dayPnl).toBeCloseTo(500)
    expect(rows[1]!.dayPnl).toBeCloseTo(-300)
    expect(totals.dayPnl).toBeCloseTo(200)
  })

  it('leaves unpriced positions at cost and out of the P&L', () => {
    const { rows, totals } = valuePositions(
      [
        { symbol: 'PEP', netQuantity: 100, averageCost: 130 },
        { symbol: 'XYZ', netQuantity: 10, averageCost: 50 },
      ],
      new Map([['PEP', quote('PEP', 135, null)]]),
    )

    expect(rows[1]).toMatchObject({
      last: null,
      marketValue: null,
      unrealizedPnl: null,
      dayPnl: null,
    })
    expect(rows[0]!.dayPnl).toBeNull()
    expect(totals).toMatchObject({ positions: 2, priced: 1, unrealizedPnl: 500, dayPnl: 0 })
  })

  it('totals long, short, net and gross exposure', () => {
    const { totals } = valuePositions(
      [
        { symbol: 'L', netQuantity: 100, averageCost: 10 },
        { symbol: 'S', netQuantity: -50, averageCost: 10 },
      ],
      new Map([
        ['L', quote('L', 12, null)],
        ['S', quote('S', 8, null)],
      ]),
    )

    expect(totals).toMatchObject({
      longs: 1,
      shorts: 1,
      longMarketValue: 1_200,
      shortMarketValue: -400,
      netExposure: 800,
      grossExposure: 1_600,
      unrealizedPnl: 300, // +200 on the long, +100 on the short
    })
  })
})

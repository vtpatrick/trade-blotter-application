import { describe, expect, it } from 'vitest'
import type { DatedTechnicals } from '@/api/bloomberg'
import { NO_TECHNICALS, technicalColumns, technicalsOnDate } from '../technicals'

const day = (date: string, rsi14: number): DatedTechnicals => ({
  date,
  rsi14,
  ma50: 100,
  ma200: 80,
  vol30: 25,
})

describe('technicals', () => {
  const history = [day('2026-09-28', 40), day('2026-09-29', 39), day('2026-09-30', 34)]

  it('uses the trade date’s figures when Bloomberg has them', () => {
    expect(technicalsOnDate(history, '2026-09-29')?.rsi14).toBe(39)
  })

  it('falls back to the last trading day before the trade (weekend, or today before the close)', () => {
    expect(technicalsOnDate(history, '2026-10-03')?.date).toBe('2026-09-30')
  })

  it('has nothing for a date before the history starts', () => {
    expect(technicalsOnDate(history, '2026-09-01')).toBeUndefined()
  })

  it('measures the price against the moving averages in percent', () => {
    expect(technicalColumns(110, { rsi14: 55, ma50: 100, ma200: 80, vol30: 25 })).toEqual({
      rsi14: 55,
      vsMa50: expect.closeTo(10, 9),
      vsMa200: expect.closeTo(37.5, 9),
      vol30: 25,
    })
  })

  it('leaves comparisons empty without a price or an average', () => {
    expect(technicalColumns(null, { rsi14: 55, ma50: 100, ma200: null, vol30: 25 })).toEqual({
      rsi14: 55,
      vsMa50: null,
      vsMa200: null,
      vol30: 25,
    })
    expect(technicalColumns(110, undefined)).toEqual(NO_TECHNICALS)
  })
})

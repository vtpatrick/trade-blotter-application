import type { DatedTechnicals, Technicals } from '@/api/bloomberg'

/** What the grids show: RSI, price against the moving averages, and volatility. */
export interface TechnicalColumns {
  rsi14: number | null
  /** Price against the 50-day moving average, in percent (+5 = 5% above). */
  vsMa50: number | null
  vsMa200: number | null
  vol30: number | null
}

export const NO_TECHNICALS: TechnicalColumns = {
  rsi14: null,
  vsMa50: null,
  vsMa200: null,
  vol30: null,
}

const versus = (price: number | null, average: number | null) =>
  price !== null && average !== null && average > 0 ? (price / average - 1) * 100 : null

/** Display figures for a price (a trade's, or the live last) against Bloomberg's technicals. */
export function technicalColumns(
  price: number | null,
  t: Technicals | undefined,
): TechnicalColumns {
  if (!t) return NO_TECHNICALS
  return {
    rsi14: t.rsi14,
    vsMa50: versus(price, t.ma50),
    vsMa200: versus(price, t.ma200),
    vol30: t.vol30,
  }
}

/**
 * The technicals in effect on a date: that day's, or the last trading day before it (a trade
 * booked today, before Bloomberg has today's figures, uses yesterday's). `history` is in date order.
 */
export function technicalsOnDate(
  history: DatedTechnicals[],
  date: string,
): DatedTechnicals | undefined {
  let lo = 0
  let hi = history.length - 1
  let found: DatedTechnicals | undefined
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (history[mid]!.date <= date) {
      found = history[mid]
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

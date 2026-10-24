import type { LiveQuote } from '@/api/bloomberg'
import type { Position } from '@/api/trades'

export interface ValuedPosition {
  symbol: string
  name: string | null
  /** Positive is long, negative is short. */
  netQuantity: number
  averageCost: number
  /** Signed: what the open shares cost (negative for a short). */
  costBasis: number
  last: number | null
  dayChangePercent: number | null
  /** Signed: quantity × last. */
  marketValue: number | null
  /** (last − average cost) × quantity: shorts gain when the price falls. */
  unrealizedPnl: number | null
  unrealizedPercent: number | null
  /** quantity × (last − previous close), from Bloomberg's day change. */
  dayPnl: number | null
}

export interface PortfolioTotals {
  positions: number
  longs: number
  shorts: number
  priced: number
  longMarketValue: number
  shortMarketValue: number
  netExposure: number
  grossExposure: number
  unrealizedPnl: number
  dayPnl: number
}

/** Marks positions to live prices. Positions without a price keep their cost and show no P&L. */
export function valuePositions(positions: Position[], quotes: ReadonlyMap<string, LiveQuote>) {
  const rows: ValuedPosition[] = positions.map((p) => {
    const quote = quotes.get(p.symbol)
    const costBasis = p.netQuantity * p.averageCost
    if (!quote) {
      return {
        symbol: p.symbol,
        name: null,
        netQuantity: p.netQuantity,
        averageCost: p.averageCost,
        costBasis,
        last: null,
        dayChangePercent: null,
        marketValue: null,
        unrealizedPnl: null,
        unrealizedPercent: null,
        dayPnl: null,
      }
    }

    const marketValue = p.netQuantity * quote.last
    const previousClose =
      quote.changePercent === null ? null : quote.last / (1 + quote.changePercent / 100)
    return {
      symbol: p.symbol,
      name: quote.name || null,
      netQuantity: p.netQuantity,
      averageCost: p.averageCost,
      costBasis,
      last: quote.last,
      dayChangePercent: quote.changePercent,
      marketValue,
      unrealizedPnl: marketValue - costBasis,
      unrealizedPercent: Math.sign(p.netQuantity) * (quote.last / p.averageCost - 1) * 100,
      dayPnl: previousClose === null ? null : p.netQuantity * (quote.last - previousClose),
    }
  })

  return { rows, totals: summarize(rows) }
}

/** Totals over any set of valued rows (e.g. the filtered rows on screen). */
export function summarize(rows: ValuedPosition[]): PortfolioTotals {
  const sum = (
    pick: (r: ValuedPosition) => number | null,
    where: (r: ValuedPosition) => boolean = () => true,
  ) => rows.filter(where).reduce((total, r) => total + (pick(r) ?? 0), 0)

  const longMarketValue = sum(
    (r) => r.marketValue,
    (r) => r.netQuantity > 0,
  )
  const shortMarketValue = sum(
    (r) => r.marketValue,
    (r) => r.netQuantity < 0,
  )

  return {
    positions: rows.length,
    longs: rows.filter((r) => r.netQuantity > 0).length,
    shorts: rows.filter((r) => r.netQuantity < 0).length,
    priced: rows.filter((r) => r.last !== null).length,
    longMarketValue,
    shortMarketValue,
    netExposure: longMarketValue + shortMarketValue,
    grossExposure: longMarketValue - shortMarketValue,
    unrealizedPnl: sum((r) => r.unrealizedPnl),
    dayPnl: sum((r) => r.dayPnl),
  }
}

/** Mirrors api/src/TradeBlotter.Api/Contracts/TradeContracts.cs and Domain/Position.cs */
export type TradeSide = 'Buy' | 'Sell'

export interface Trade {
  id: number
  symbol: string
  side: TradeSide
  quantity: number
  price: number
  notional: number
  /** ISO 8601, UTC, assigned by the server. */
  timestamp: string
}

export interface NewTrade {
  symbol: string
  side: TradeSide
  quantity: number
  price: number
}

export interface Position {
  symbol: string
  /** Positive is long, negative is short. */
  netQuantity: number
  averageCost: number
}

/** A 400 from the API, with messages keyed by request field (symbol, side, quantity, price). */
export class TradeRejectedError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string>,
  ) {
    super(message)
    this.name = 'TradeRejectedError'
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`GET ${url} failed (HTTP ${response.status})`)
  }
  return (await response.json()) as T
}

export function fetchTrades(): Promise<Trade[]> {
  return getJson<Trade[]>('/api/trades')
}

export function fetchPositions(): Promise<Position[]> {
  return getJson<Position[]>('/api/positions')
}

export async function createTrade(trade: NewTrade): Promise<Trade> {
  const response = await fetch('/api/trades', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(trade),
  })

  if (response.status === 400) {
    // ASP.NET ValidationProblemDetails: { title, errors: { Quantity: ["..."] } }
    const problem = (await response.json().catch(() => ({}))) as {
      title?: string
      errors?: Record<string, string[]>
    }
    const fieldErrors: Record<string, string> = {}
    for (const [key, messages] of Object.entries(problem.errors ?? {})) {
      const field = key.replace(/^\$\.?/, '').toLowerCase() || 'form'
      fieldErrors[field] = messages[0] ?? 'Invalid value.'
    }
    throw new TradeRejectedError(problem.title ?? 'The trade was rejected.', fieldErrors)
  }

  if (!response.ok) {
    throw new Error(`Could not book the trade (HTTP ${response.status}).`)
  }

  return (await response.json()) as Trade
}

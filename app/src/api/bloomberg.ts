/**
 * Live prices from Bloomberg on the user's own desktop, through DeskLink (localhost:9195).
 * Called from the browser, never through our API: Bloomberg lives on the desk, not the server.
 * On a machine without DeskLink or a Bloomberg session this simply reports "unavailable".
 * DeskLink must list this app's origin under Hosting > Allowed hosts.
 */
const DESKLINK_URL =
  (import.meta.env.VITE_DESKLINK_URL as string | undefined) ?? 'http://localhost:9195'

/** DeskLink's cache serves a price up to this old instead of hitting Bloomberg again. */
const CACHE_SECONDS = 15

export interface LiveQuote {
  symbol: string
  name: string
  last: number
  /** Percent change on the day; null when Bloomberg has none. */
  changePercent: number | null
  asOf: string
}

/** DeskLink or Bloomberg could not answer (not running, not logged in, origin not allowed). */
export class LivePriceUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LivePriceUnavailableError'
  }
}

interface BdpEnvelope {
  ok: boolean
  error?: string
  data?: {
    asOf?: string
    data?: Record<string, Record<string, string | null> | undefined>
    errors?: string[]
  }
}

/** Bloomberg writes share classes with a slash: BRK.B is "BRK/B US Equity". */
export function toBloombergSecurity(symbol: string): string {
  return `${symbol.trim().toUpperCase().replace(/\./g, '/')} US Equity`
}

const normalize = (symbol: string) => symbol.trim().toUpperCase()

/** One bdp call for any number of securities; throws LivePriceUnavailableError if DeskLink fails. */
async function bdp(securities: string[], signal?: AbortSignal) {
  let response: Response
  try {
    response = await fetch(`${DESKLINK_URL}/con/bloomberg/bdp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        securities,
        fields: ['PX_LAST', 'NAME', 'CHG_PCT_1D'],
        mode: 'auto',
        ttlSeconds: CACHE_SECONDS,
      }),
      signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new LivePriceUnavailableError('DeskLink is not reachable from this page')
  }

  const body = (await response.json().catch(() => null)) as BdpEnvelope | null
  if (!body?.ok || !body.data) {
    throw new LivePriceUnavailableError(body?.error ?? `DeskLink error (HTTP ${response.status})`)
  }
  return body.data
}

function toQuote(
  symbol: string,
  fields: Record<string, string | null> | undefined,
  asOf: string,
): LiveQuote | null {
  const last = Number(fields?.PX_LAST)
  if (fields?.PX_LAST == null || !Number.isFinite(last)) return null
  const change = Number(fields.CHG_PCT_1D)
  return {
    symbol,
    name: fields.NAME ?? '',
    last,
    changePercent: fields.CHG_PCT_1D != null && Number.isFinite(change) ? change : null,
    asOf,
  }
}

const isUnknownSecurity = (error: string) => error.includes('INVALID_SECURITY')

/**
 * Live quotes for several symbols in one Bloomberg request, keyed by upper-case symbol.
 * Symbols Bloomberg does not know are left out.
 */
export async function fetchLiveQuotes(
  symbols: string[],
  signal?: AbortSignal,
): Promise<Map<string, LiveQuote>> {
  const unique = [...new Set(symbols.map(normalize))].filter(Boolean)
  const quotes = new Map<string, LiveQuote>()
  if (unique.length === 0) return quotes

  const data = await bdp(unique.map(toBloombergSecurity), signal)
  const asOf = data.asOf ?? new Date().toISOString()
  for (const symbol of unique) {
    const quote = toQuote(symbol, data.data?.[toBloombergSecurity(symbol)], asOf)
    if (quote) quotes.set(symbol, quote)
  }

  // Nothing priced and Bloomberg said why (not entitled, no session): that is unavailable, not unknown.
  const failure = (data.errors ?? []).find((e) => !isUnknownSecurity(e))
  if (quotes.size === 0 && failure) throw new LivePriceUnavailableError(failure)

  return quotes
}

/** The live quote, or null when Bloomberg does not know the ticker. */
export async function fetchLiveQuote(
  symbol: string,
  signal?: AbortSignal,
): Promise<LiveQuote | null> {
  return (await fetchLiveQuotes([symbol], signal)).get(normalize(symbol)) ?? null
}

// ---------- security description (DES) and price history ----------

/** Key fields for a position's detail panel; null where Bloomberg has no value. */
export interface SecurityProfile {
  name: string
  sector: string | null
  industry: string | null
  currency: string | null
  marketCap: number | null
  peRatio: number | null
  forwardPe: number | null
  priceToBook: number | null
  evToEbitda: number | null
  dividendYield: number | null
  dividendPerShare12m: number | null
  payoutRatio: number | null
  exDividendDate: string | null
  high52w: number | null
  low52w: number | null
  beta: number | null
  avgVolume30d: number | null
}

const PROFILE_FIELDS = {
  name: 'NAME',
  sector: 'GICS_SECTOR_NAME',
  industry: 'GICS_INDUSTRY_NAME',
  currency: 'CRNCY',
  marketCap: 'CUR_MKT_CAP',
  peRatio: 'PE_RATIO',
  forwardPe: 'BEST_PE_RATIO',
  priceToBook: 'PX_TO_BOOK_RATIO',
  evToEbitda: 'CURRENT_EV_TO_T12M_EBITDA',
  dividendYield: 'EQY_DVD_YLD_IND',
  dividendPerShare12m: 'DVD_SH_12M',
  payoutRatio: 'DVD_PAYOUT_RATIO',
  exDividendDate: 'DVD_EX_DT',
  high52w: 'HIGH_52WEEK',
  low52w: 'LOW_52WEEK',
  beta: 'EQY_BETA',
  avgVolume30d: 'VOLUME_AVG_30D',
} as const

const TEXT_FIELDS = new Set(['name', 'sector', 'industry', 'currency', 'exDividendDate'])

/** Fundamentals change slowly: let DeskLink's cache serve them for an hour. */
const PROFILE_CACHE_SECONDS = 3600

async function postDeskLink<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${DESKLINK_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new LivePriceUnavailableError('DeskLink is not reachable from this page')
  }
  const envelope = (await response.json().catch(() => null)) as {
    ok: boolean
    error?: string
    data?: T
  } | null
  if (!envelope?.ok || envelope.data === undefined) {
    throw new LivePriceUnavailableError(
      envelope?.error ?? `DeskLink error (HTTP ${response.status})`,
    )
  }
  return envelope.data
}

/** The DES-style fields for one symbol, or null when Bloomberg does not know it. */
export async function fetchSecurityProfile(
  symbol: string,
  signal?: AbortSignal,
): Promise<SecurityProfile | null> {
  const security = toBloombergSecurity(symbol)
  const data = await postDeskLink<NonNullable<BdpEnvelope['data']>>(
    '/con/bloomberg/bdp',
    {
      securities: [security],
      fields: Object.values(PROFILE_FIELDS),
      mode: 'auto',
      ttlSeconds: PROFILE_CACHE_SECONDS,
    },
    signal,
  )

  const raw = data.data?.[security]
  if (!raw || raw.NAME == null) return null

  const profile = {} as Record<string, string | number | null>
  for (const [key, field] of Object.entries(PROFILE_FIELDS)) {
    const value = raw[field] ?? null
    if (TEXT_FIELDS.has(key)) {
      profile[key] = value
    } else {
      const n = Number(value)
      profile[key] = value === null || !Number.isFinite(n) ? null : n
    }
  }
  return profile as unknown as SecurityProfile
}

export interface PricePoint {
  /** YYYY-MM-DD */
  date: string
  close: number
}

// Five years of daily closes per symbol, fetched once per session: bdh has no DeskLink cache
// mode, and the chart's 1Y to 5Y ranges are all slices of the same series.
const historyCache = new Map<string, Promise<PricePoint[]>>()

export const HISTORY_YEARS = 5

export function fetchPriceHistory(symbol: string): Promise<PricePoint[]> {
  const key = normalize(symbol)
  let pending = historyCache.get(key)
  if (!pending) {
    const end = new Date()
    const start = new Date(end)
    start.setFullYear(end.getFullYear() - HISTORY_YEARS)
    const day = (d: Date) => d.toISOString().slice(0, 10)
    const security = toBloombergSecurity(key)

    pending = postDeskLink<Record<string, { date: string; PX_LAST: string | null }[]>>(
      '/con/bloomberg/bdh',
      {
        securities: [security],
        fields: ['PX_LAST'],
        startDate: day(start),
        endDate: day(end),
        periodicitySelection: 'DAILY',
      },
    ).then((data) =>
      (data[security] ?? [])
        .map((row) => ({ date: row.date, close: Number(row.PX_LAST) }))
        .filter((p) => p.close > 0 && Number.isFinite(p.close)),
    )
    // A failed request is not cached, so opening the row again retries.
    pending.catch(() => historyCache.delete(key))
    historyCache.set(key, pending)
  }
  return pending
}

/** For tests. */
export function clearPriceHistoryCache() {
  historyCache.clear()
}

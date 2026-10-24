import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearPriceHistoryCache,
  fetchLiveQuote,
  fetchPriceHistory,
  fetchSecurityProfile,
  fetchLiveQuotes,
  LivePriceUnavailableError,
  toBloombergSecurity,
} from '../bloomberg'

function bdp(security: string, fields: Record<string, string | null>, errors: string[] = []) {
  return new Response(
    JSON.stringify({
      ok: true,
      data: { asOf: '2026-10-24T13:35:16Z', data: { [security]: fields }, errors },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

describe('bloomberg client', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal('fetch', fetchMock))
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('maps tickers to Bloomberg securities, including share classes', () => {
    expect(toBloombergSecurity(' aapl ')).toBe('AAPL US Equity')
    expect(toBloombergSecurity('brk.b')).toBe('BRK/B US Equity')
  })

  it('asks DeskLink bdp for last, name and change through its cache', async () => {
    fetchMock.mockResolvedValue(
      bdp('AAPL US Equity', { PX_LAST: '347.725', NAME: 'APPLE INC', CHG_PCT_1D: '-0.1421515' }),
    )

    const quote = await fetchLiveQuote('aapl')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://localhost:9195/con/bloomberg/bdp')
    expect(JSON.parse(init!.body as string)).toEqual({
      securities: ['AAPL US Equity'],
      fields: ['PX_LAST', 'NAME', 'CHG_PCT_1D'],
      mode: 'auto',
      ttlSeconds: 15,
    })
    expect(quote).toEqual({
      symbol: 'AAPL',
      name: 'APPLE INC',
      last: 347.725,
      changePercent: -0.1421515,
      asOf: '2026-10-24T13:35:16Z',
    })
  })

  it('returns null for a ticker Bloomberg does not know', async () => {
    fetchMock.mockResolvedValue(
      bdp('ZZQXQ US Equity', { PX_LAST: null, NAME: null, CHG_PCT_1D: null }, [
        'ZZQXQ US Equity: BAD_SEC/INVALID_SECURITY Unknown/Invalid Security',
      ]),
    )

    expect(await fetchLiveQuote('ZZQXQ')).toBeNull()
  })

  it('reports unavailable when DeskLink cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(fetchLiveQuote('AAPL')).rejects.toBeInstanceOf(LivePriceUnavailableError)
  })

  it('reports unavailable when DeskLink answers with an error', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'Bloomberg session not ready' }), {
        status: 502,
      }),
    )

    await expect(fetchLiveQuote('AAPL')).rejects.toThrow('Bloomberg session not ready')
  })

  it('prices several symbols in one request and leaves out unknown ones', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            asOf: '2026-10-24T13:35:16Z',
            data: {
              'KO US Equity': { PX_LAST: '92.71', NAME: 'COCA-COLA CO/THE', CHG_PCT_1D: '-2.76' },
              'BRK/B US Equity': { PX_LAST: '542.19', NAME: 'BERKSHIRE', CHG_PCT_1D: null },
              'ZZQXQ US Equity': { PX_LAST: null, NAME: null, CHG_PCT_1D: null },
            },
            errors: ['ZZQXQ US Equity: BAD_SEC/INVALID_SECURITY Unknown/Invalid Security'],
          },
        }),
        { status: 200 },
      ),
    )

    const quotes = await fetchLiveQuotes(['ko', 'BRK.B', 'zzqxq', 'KO'])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string).securities).toEqual([
      'KO US Equity',
      'BRK/B US Equity',
      'ZZQXQ US Equity',
    ])
    expect([...quotes.keys()]).toEqual(['KO', 'BRK.B'])
    expect(quotes.get('BRK.B')?.changePercent).toBeNull()
  })

  it('makes no request for an empty list', async () => {
    expect((await fetchLiveQuotes([])).size).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('parses the description fields, numbers as numbers and text as text', async () => {
    fetchMock.mockResolvedValue(
      bdp('KO US Equity', {
        NAME: 'COCA-COLA CO/THE',
        GICS_SECTOR_NAME: 'Consumer Staples',
        CUR_MKT_CAP: '398889340318.53',
        PE_RATIO: '27.57',
        EQY_DVD_YLD_IND: '2.2867',
        DVD_EX_DT: '2026-12-01',
        EQY_BETA: null,
      }),
    )

    const profile = await fetchSecurityProfile('KO')

    expect(profile).toMatchObject({
      name: 'COCA-COLA CO/THE',
      sector: 'Consumer Staples',
      marketCap: 398889340318.53,
      peRatio: 27.57,
      dividendYield: 2.2867,
      exDividendDate: '2026-12-01',
      beta: null,
    })
  })

  it('fetches five years of daily history once per symbol and reuses it', async () => {
    clearPriceHistoryCache()
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              'KO US Equity': [
                { date: '2021-10-25', PX_LAST: '54.23' },
                { date: '2021-10-26', PX_LAST: null },
                { date: '2026-10-23', PX_LAST: '92.71' },
              ],
            },
          }),
          { status: 200 },
        ),
    )

    const first = await fetchPriceHistory('ko')
    const second = await fetchPriceHistory('KO')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
    expect(fetchMock.mock.calls[0]![0]).toBe('http://localhost:9195/con/bloomberg/bdh')
    expect(body).toMatchObject({
      securities: ['KO US Equity'],
      fields: ['PX_LAST'],
      periodicitySelection: 'DAILY',
    })
    expect(Number(body.endDate.slice(0, 4)) - Number(body.startDate.slice(0, 4))).toBe(5)
    expect(first).toEqual([
      { date: '2021-10-25', close: 54.23 },
      { date: '2026-10-23', close: 92.71 },
    ])
    expect(second).toBe(first)
  })
})

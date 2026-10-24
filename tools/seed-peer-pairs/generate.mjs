#!/usr/bin/env node
// Generates the blotter's seed portfolio: study 35's "standing pair" from trading-strategies
// (35-peer-shocks), traded on real daily closes from Interactive Brokers.
//
// Rule, per peer group, at each month-end close:
//   rank the members by 60-day return less the group's average (the "gap"),
//   hold the laggard long and the leader short, equal dollars per leg, until the next month end.
// Legs whose name changes are closed (or flipped); legs that stay are resized back to the
// target only when they have drifted by more than 5% of the leg.
//
// Prices: daily TRADES bars from IBKR through DeskLink (POST /con/ibkr/history), cached in
// .cache/ so re-runs do not hit IBKR. Only market-data calls are made.
//
//   node tools/seed-peer-pairs/generate.mjs            # use the cache, fetch what is missing
//   node tools/seed-peer-pairs/generate.mjs --refresh  # re-fetch every symbol
//   node tools/seed-peer-pairs/generate.mjs --from 2025-10 --to 2026-09   (the default: a year)
//
// Writes api/src/TradeBlotter.Api/Data/Seed/peer-pairs-trades.json and docs/seed-portfolio.md.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..', '..')

// Six of study 35's 43 groups: familiar names, mostly ones the study's "Now" tab flags.
const GROUPS = {
  TELCO: { label: 'US telecoms', members: ['T', 'VZ', 'TMUS'] },
  BIGBOX: { label: 'Big-box retail', members: ['WMT', 'TGT', 'COST'] },
  // Parcel (UPS/FDX) is left out: IBKR back-adjusts FDX before the June 2026 FedEx Freight spin-off,
  // so a year of real FDX fills is not available.
  CARDS: { label: 'Card networks', members: ['V', 'MA', 'AXP'] },
  HOMEIMP: { label: 'Home improvement', members: ['HD', 'LOW'] },
  BEV: { label: 'Soft drinks', members: ['KO', 'PEP'] },
  AUTO: { label: 'US automakers', members: ['GM', 'F'] },
}

const LOOKBACK = 60 // sessions, as in the study
// Two years of bars: a year of month ends, plus the 60-session lookback before the first one.
const HISTORY = '2 Y'
const LEG_DOLLARS = 25_000
const RESIZE_THRESHOLD = 0.05 // of a leg
const DESKLINK = process.env.DESKLINK_URL ?? 'http://localhost:9195'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const FROM = option('--from', '2025-10') // first month-end to trade
const TO = option('--to', '2026-09') // last month-end to trade

// ---------- prices ----------

const cacheDir = join(here, '.cache')
const cacheFile = (symbol) => join(cacheDir, `${symbol}.json`)

async function fetchBars(symbol) {
  const response = await fetch(`${DESKLINK}/con/ibkr/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, secType: 'STK', duration: HISTORY, barSize: '1 day', whatToShow: 'TRADES' }),
  })
  const body = await response.json().catch(() => ({}))
  if (!body.ok) throw new Error(`${symbol}: ${body.error ?? `HTTP ${response.status}`}`)
  const bars = body.data?.bars ?? []
  if (bars.length === 0 || bars.some((b) => typeof b.close !== 'number')) {
    throw new Error(`${symbol}: no usable bars returned`)
  }
  return bars.map((b) => ({ date: b.date, close: b.close }))
}

async function loadBars(symbol) {
  if (!flag('--refresh') && existsSync(cacheFile(symbol))) {
    return JSON.parse(await readFile(cacheFile(symbol), 'utf8'))
  }
  process.stdout.write(`fetching ${symbol} from IBKR... `)
  const bars = await fetchBars(symbol)
  await writeFile(cacheFile(symbol), JSON.stringify(bars))
  console.log(`${bars.length} bars, ${bars[0].date} to ${bars.at(-1).date}`)
  return bars
}

// A one-day move this large in these names means an unadjusted split, which would corrupt the
// 60-day ranking (TRADES bars are not split-adjusted).
function checkForSplits(symbol, bars) {
  for (let i = 1; i < bars.length; i++) {
    const move = bars[i].close / bars[i - 1].close - 1
    if (Math.abs(move) > 0.3) {
      throw new Error(`${symbol}: ${(move * 100).toFixed(0)}% move on ${bars[i].date}; check for a split`)
    }
  }
}

// IBKR back-adjusts history for corporate actions (spin-offs, special dividends), which shows up as
// closes that are not whole cents. Rankings can use them (they are consistent across the event), but a
// fill must be a price that actually printed, so fills on or before the last adjusted date are refused.
function lastAdjustedDate(bars) {
  const adjusted = bars.filter((b) => Math.abs(b.close * 100 - Math.round(b.close * 100)) > 1e-6)
  return adjusted.length ? adjusted.at(-1).date : null
}

// ---------- time ----------

/** Offset of `timeZone` from UTC at the given instant, in minutes (New York in summer: -240). */
function zoneOffsetMinutes(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type) => Number(parts.find((p) => p.type === type).value)
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return (local - utcMs) / 60_000
}

/** The New York close (16:00 local) on a YYYYMMDD date, plus a few seconds to order the tickets. */
function closeTimestamp(yyyymmdd, secondsAfter) {
  const y = Number(yyyymmdd.slice(0, 4))
  const m = Number(yyyymmdd.slice(4, 6))
  const d = Number(yyyymmdd.slice(6, 8))
  const asIfUtc = Date.UTC(y, m - 1, d, 16, 0, 0)
  const utc = asIfUtc - zoneOffsetMinutes(asIfUtc, 'America/New_York') * 60_000
  return new Date(utc + secondsAfter * 1000).toISOString()
}

const isoDate = (yyyymmdd) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`

// ---------- strategy ----------

async function main() {
  await mkdir(cacheDir, { recursive: true })

  const symbols = Object.values(GROUPS).flatMap((g) => g.members)
  const closes = new Map() // symbol -> Map(date -> close)
  const adjustedUntil = new Map() // symbol -> last date of back-adjusted closes
  for (const symbol of symbols) {
    const bars = await loadBars(symbol)
    checkForSplits(symbol, bars)
    closes.set(symbol, new Map(bars.map((b) => [b.date, b.close])))
    const adjusted = lastAdjustedDate(bars)
    if (adjusted) adjustedUntil.set(symbol, adjusted)
  }

  // Sessions where every symbol has a close.
  const calendar = [...closes.get(symbols[0]).keys()]
    .filter((date) => symbols.every((s) => closes.get(s).has(date)))
    .sort()

  // Last session of each month in the window.
  const monthEnds = calendar.filter((date, i) => {
    const month = isoDate(date).slice(0, 7)
    const next = calendar[i + 1]
    return month >= FROM && month <= TO && next !== undefined && next.slice(0, 6) !== date.slice(0, 6)
  })
  if (monthEnds.length === 0) throw new Error(`no complete month ends between ${FROM} and ${TO}`)

  const held = new Map() // symbol -> signed shares
  const trades = []
  const rebalances = []

  for (const date of monthEnds) {
    const i = calendar.indexOf(date)
    if (i < LOOKBACK) throw new Error(`not enough history before ${date} for a ${LOOKBACK}-day lookback`)
    const lookbackDate = calendar[i - LOOKBACK]
    let ticket = 0

    for (const [key, group] of Object.entries(GROUPS)) {
      const returns = group.members.map((s) => closes.get(s).get(date) / closes.get(s).get(lookbackDate) - 1)
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length
      const gaps = returns.map((r) => r - mean)
      const leader = group.members[gaps.indexOf(Math.max(...gaps))]
      const laggard = group.members[gaps.indexOf(Math.min(...gaps))]

      const groupTrades = []
      for (const symbol of group.members) {
        const price = closes.get(symbol).get(date)
        const shares = Math.round(LEG_DOLLARS / price)
        const target = symbol === laggard ? shares : symbol === leader ? -shares : 0
        const current = held.get(symbol) ?? 0
        const diff = target - current
        if (diff === 0) continue

        const sameDirection = target !== 0 && Math.sign(target) === Math.sign(current)
        if (sameDirection && Math.abs(diff) * price < RESIZE_THRESHOLD * LEG_DOLLARS) continue
        if (adjustedUntil.has(symbol) && date <= adjustedUntil.get(symbol)) {
          throw new Error(`${symbol}: a fill on ${date} would use a back-adjusted close (adjusted to ${adjustedUntil.get(symbol)})`)
        }

        const action =
          current === 0 ? 'open'
          : target === 0 ? 'close'
          : Math.sign(target) !== Math.sign(current) ? 'flip'
          : 'resize'
        const trade = {
          symbol,
          side: diff > 0 ? 'Buy' : 'Sell',
          quantity: Math.abs(diff),
          price,
          timestamp: closeTimestamp(date, ++ticket),
        }
        trades.push(trade)
        groupTrades.push({ ...trade, action, from: current, to: target })
        held.set(symbol, target)
      }

      rebalances.push({
        date: isoDate(date),
        group: key,
        label: group.label,
        leader,
        laggard,
        gaps: Object.fromEntries(group.members.map((s, k) => [s, gaps[k]])),
        trades: groupTrades,
      })
    }
  }

  const seed = {
    description:
      'Simulated portfolio: study 35 standing pair (long the 60-day laggard, short the leader, ' +
      `rebalanced at month end) in ${Object.keys(GROUPS).length} peer groups, $${LEG_DOLLARS.toLocaleString('en-US')} a leg, ` +
      'filled at IBKR daily closes. Generated by tools/seed-peer-pairs/generate.mjs.',
    generatedAt: new Date().toISOString(),
    trades,
  }
  const seedPath = join(repo, 'api', 'src', 'TradeBlotter.Api', 'Data', 'Seed', 'peer-pairs-trades.json')
  await mkdir(dirname(seedPath), { recursive: true })
  await writeFile(seedPath, JSON.stringify(seed, null, 2) + '\n')

  const docPath = join(repo, 'docs', 'seed-portfolio.md')
  await writeFile(docPath, renderDoc(monthEnds, rebalances, held, closes, calendar, adjustedUntil))

  const longs = [...held].filter(([, q]) => q > 0).map(([s]) => s)
  const shorts = [...held].filter(([, q]) => q < 0).map(([s]) => s)
  console.log(`\n${trades.length} trades over ${monthEnds.length} month ends (${monthEnds.map(isoDate).join(', ')})`)
  console.log(`open now: long ${longs.join(', ')}; short ${shorts.join(', ')}`)
  console.log(`wrote ${seedPath}\nwrote ${docPath}`)
}

// ---------- docs ----------

const pct = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`

function renderDoc(monthEnds, rebalances, held, closes, calendar, adjustedUntil) {
  const lines = [
    '# Seed portfolio: peer-group pairs',
    '',
    '_Generated by `tools/seed-peer-pairs/generate.mjs`; do not edit by hand._',
    '',
    'In development, an empty database is seeded with these trades (see `TradeSeeder`), so the blotter and',
    'positions panel open on a realistic book. Trades booked through the app are added on top.',
    '',
    '## The strategy',
    '',
    'Study 35 in `trading-strategies` (`35-peer-shocks`) tested whether close peers converge when their group is',
    'shocked down. They do not, but its "standing pair" did hold up: every month, in every peer group, **long the',
    'name that has lagged its group most over 60 sessions and short the one that has led it most**. Over 1995 to',
    '2026 that made 5.6% a year at a Sharpe of 0.77 (0.51 since 2011): the known within-industry reversal.',
    '',
    `Here it runs in six of the study's groups, $${LEG_DOLLARS.toLocaleString('en-US')} a leg, rebalanced at each month-end close.`,
    'A leg whose name changes is closed, or flipped in one ticket when a name goes from laggard to leader. A leg',
    `that stays is resized back to $${LEG_DOLLARS.toLocaleString('en-US')} only if it has drifted by more than ${RESIZE_THRESHOLD * 100}%.`,
    '',
    '**Prices** are Interactive Brokers daily closes (TRADES bars, not dividend-adjusted) pulled through DeskLink.',
    'Fills are at the close; timestamps are 16:00 New York, a second apart to keep the tickets in order.',
    'This is a simulation for demonstration, not a record of real executions.',
    '',
    ...(adjustedUntil.size
      ? [
          '**Adjusted history.** IBKR back-adjusts closes for corporate actions: ' +
            [...adjustedUntil].map(([s, d]) => `${s} up to ${isoDate(d)}`).join(', ') +
            '. The 60-day rankings use those adjusted closes, which stay consistent across the event; every fill',
          'is dated after them, so each fill price is a close that actually printed (the generator refuses otherwise).',
          '',
        ]
      : []),
    '| Group | Members |',
    '| --- | --- |',
    ...Object.values(GROUPS).map((g) => `| ${g.label} | ${g.members.join(', ')} |`),
    '',
  ]

  for (const date of monthEnds.map(isoDate)) {
    lines.push(`## ${date}`, '', '| Group | Gap vs group (60d) | Laggard (long) | Leader (short) | Trades |', '| --- | --- | --- | --- | --- |')
    for (const r of rebalances.filter((x) => x.date === date)) {
      const gaps = Object.entries(r.gaps).map(([s, g]) => `${s} ${pct(g)}`).join(', ')
      const trades = r.trades.length
        ? r.trades.map((t) => `${t.side} ${t.quantity} ${t.symbol} @ ${t.price} (${t.action})`).join('<br>')
        : 'none'
      lines.push(`| ${r.label} | ${gaps} | ${r.laggard} | ${r.leader} | ${trades} |`)
    }
    lines.push('')
  }

  const last = calendar.at(-1)
  lines.push(`## Open after the last rebalance`, '', `Marked at the ${isoDate(last)} close (latest bar pulled).`, '', '| Symbol | Shares | Last close |', '| --- | --- | --- |')
  for (const [symbol, qty] of [...held].filter(([, q]) => q !== 0).sort()) {
    lines.push(`| ${symbol} | ${qty} | ${closes.get(symbol).get(last)} |`)
  }
  lines.push('')
  return lines.join('\n')
}

main().catch((e) => {
  console.error(`\nFAILED: ${e.message}`)
  process.exit(1)
})

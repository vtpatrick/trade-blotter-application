<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  fetchPriceHistory,
  fetchSecurityProfile,
  type PricePoint,
  type SecurityProfile,
} from '@/api/bloomberg'
import { useBlotterStore } from '@/stores/blotter'
import { formatPrice, formatQuantity } from '@/utils/format'
import PriceHistoryChart, { type ChartTrade } from './PriceHistoryChart.vue'

const props = defineProps<{
  symbol: string
  averageCost: number
  last: number | null
}>()

const { trades } = storeToRefs(useBlotterStore())

const profile = ref<SecurityProfile | null>(null)
const profileState = ref<'loading' | 'ready' | 'not-found' | 'unavailable'>('loading')
const history = ref<PricePoint[]>([])
const historyState = ref<'loading' | 'ready' | 'unavailable'>('loading')

const controller = new AbortController()
onBeforeUnmount(() => controller.abort())

onMounted(() => {
  fetchSecurityProfile(props.symbol, controller.signal)
    .then((p) => {
      profile.value = p
      profileState.value = p ? 'ready' : 'not-found'
    })
    .catch(() => {
      if (!controller.signal.aborted) profileState.value = 'unavailable'
    })

  fetchPriceHistory(props.symbol)
    .then((points) => {
      history.value = points
      historyState.value = 'ready'
    })
    .catch(() => (historyState.value = 'unavailable'))
})

// Trades for this symbol, dated by the New York session they were booked in.
const tradeDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
const chartTrades = computed<ChartTrade[]>(() =>
  trades.value
    .filter((t) => t.symbol === props.symbol)
    .map((t) => ({
      date: tradeDate.format(new Date(t.timestamp)),
      side: t.side,
      quantity: t.quantity,
      price: t.price,
    })),
)

// ---------- this symbol's trade history ----------
const historyDate = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
})

/** The user's trades in this symbol, newest first, each with the net position it left. */
const tradeHistory = computed(() => {
  let net = 0
  return trades.value
    .filter((t) => t.symbol === props.symbol)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id - b.id)
    .map((t) => {
      net += t.side === 'Buy' ? t.quantity : -t.quantity
      return { ...t, date: historyDate.format(new Date(t.timestamp)), positionAfter: net }
    })
    .reverse()
})

// ---------- field formatting ----------
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const two = (v: number | null) => (v === null ? '—' : v.toFixed(2))
const ratio = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)}x`)
const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(2)}%`)
const money = (v: number | null) => (v === null ? '—' : compact.format(v))
const date = (v: string | null) =>
  v
    ? new Date(`${v}T12:00:00Z`).toLocaleDateString(undefined, {
        dateStyle: 'medium',
        timeZone: 'UTC',
      })
    : '—'

/** Rows whose values are words, not numbers: these use the text font and may wrap. */
const TEXT_LABELS = new Set(['Sector', 'Industry'])

const groups = computed<{ title: string; rows: [label: string, value: string][] }[]>(() => {
  const p = profile.value
  if (!p) return []
  return [
    {
      title: 'Company',
      rows: [
        ['Sector', p.sector ?? '—'],
        ['Industry', p.industry ?? '—'],
        [
          'Market cap',
          p.marketCap === null ? '—' : `${money(p.marketCap)} ${p.currency ?? ''}`.trim(),
        ],
      ],
    },
    {
      title: 'Valuation',
      rows: [
        ['P/E (trailing)', ratio(p.peRatio)],
        ['P/E (forward)', ratio(p.forwardPe)],
        ['Price / book', ratio(p.priceToBook)],
        ['EV / EBITDA', ratio(p.evToEbitda)],
      ],
    },
    {
      title: 'Dividend',
      rows: [
        ['Yield (indicated)', pct(p.dividendYield)],
        ['Paid, last 12m', two(p.dividendPerShare12m)],
        ['Payout ratio', pct(p.payoutRatio)],
        ['Ex-dividend', date(p.exDividendDate)],
      ],
    },
    {
      title: 'Trading',
      rows: [
        ['Beta', two(p.beta)],
        ['Avg volume (30d)', money(p.avgVolume30d)],
      ],
    },
  ]
})

/** Where the last price sits in the 52-week range, 0 to 100. */
const rangePosition = computed(() => {
  const p = profile.value
  if (!p || p.high52w === null || p.low52w === null || props.last === null || p.high52w <= p.low52w)
    return null
  return Math.min(100, Math.max(0, ((props.last - p.low52w) / (p.high52w - p.low52w)) * 100))
})
</script>

<template>
  <div class="detail">
    <section class="fields" aria-label="Security description">
      <p v-if="profileState === 'loading'" class="muted">Loading description…</p>
      <p v-else-if="profileState === 'not-found'" class="muted">
        Bloomberg has no description for {{ symbol }}.
      </p>
      <p v-else-if="profileState === 'unavailable'" class="muted">
        Description unavailable (DeskLink / Bloomberg).
      </p>
      <template v-else-if="profile">
        <h3 class="name">{{ profile.name }}</h3>

        <div v-if="profile.low52w !== null && profile.high52w !== null" class="range52">
          <span class="range-label">52-week range</span>
          <div class="range-track" :title="`Last ${last === null ? '—' : formatPrice(last)}`">
            <span
              v-if="rangePosition !== null"
              class="range-dot"
              :style="{ left: `${rangePosition}%` }"
            ></span>
          </div>
          <span class="range-ends num">
            <span>{{ formatPrice(profile.low52w) }}</span>
            <span>{{ formatPrice(profile.high52w) }}</span>
          </span>
        </div>

        <div class="groups">
          <dl v-for="g in groups" :key="g.title">
            <dt class="group-title">{{ g.title }}</dt>
            <template v-for="[label, value] in g.rows" :key="label">
              <dt>{{ label }}</dt>
              <dd :class="{ num: !TEXT_LABELS.has(label) }">{{ value }}</dd>
            </template>
          </dl>
        </div>
      </template>
    </section>

    <section class="trades" :aria-label="`Your ${symbol} trades`">
      <h3 class="panel-title">
        Your trades <span class="muted-count">{{ tradeHistory.length }}</span>
      </h3>
      <div class="trades-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Side</th>
              <th class="num">Qty</th>
              <th class="num">Price</th>
              <th class="num" title="Net position after the trade">Pos after</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tradeHistory" :key="t.id">
              <td class="date" :title="new Date(t.timestamp).toLocaleString()">{{ t.date }}</td>
              <td>
                <span class="side" :class="t.side === 'Buy' ? 'buy' : 'sell'">{{ t.side }}</span>
              </td>
              <td class="num">{{ formatQuantity(t.quantity) }}</td>
              <td class="num">{{ formatPrice(t.price) }}</td>
              <td
                class="num"
                :class="t.positionAfter > 0 ? 'long' : t.positionAfter < 0 ? 'short' : 'flat'"
              >
                {{ t.positionAfter === 0 ? 'flat' : formatQuantity(t.positionAfter) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="history">
      <p v-if="historyState === 'loading'" class="muted">Loading price history…</p>
      <p v-else-if="historyState === 'unavailable'" class="muted">
        Price history unavailable (DeskLink / Bloomberg).
      </p>
      <PriceHistoryChart
        v-else
        :symbol="symbol"
        :points="history"
        :average-cost="averageCost"
        :trades="chartTrades"
      />
    </section>
  </div>
</template>

<style scoped>
.detail {
  display: grid;
  gap: 0.5rem;
  padding: 0.5rem 0.65rem;
  background: var(--color-surface-muted);
  white-space: normal;
}

@media (min-width: 1100px) {
  .detail {
    grid-template-columns: minmax(340px, 440px) minmax(300px, 360px) minmax(0, 1fr);
  }
}

.muted {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.name {
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
}

.range52 {
  display: grid;
  gap: 0.15rem;
  margin-bottom: 0.5rem;
}

.range-label,
.group-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.range-track {
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: var(--color-border);
}

.range-dot {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border: 2px solid var(--color-surface);
  border-radius: 50%;
  background: var(--color-accent);
  transform: translate(-50%, -50%);
}

.range-ends {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 1.25rem;
}

dl {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.2rem 0.75rem;
  align-content: start;
  font-size: 0.75rem;
}

.group-title {
  grid-column: 1 / -1;
  margin-bottom: 0.1rem;
}

dt {
  color: var(--color-text-muted);
  white-space: nowrap;
}

dd {
  margin: 0;
  text-align: right;
}

/* Panels side by side, stretched to the same height so their bottoms line up. */
.fields,
.trades,
.history {
  min-width: 0;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}
.trades {
  display: flex;
  flex-direction: column;
}

.panel-title {
  margin-bottom: 0.3rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.muted-count {
  margin-left: 0.25rem;
  font-weight: 500;
}

/* Long histories scroll inside the panel instead of stretching the row. */
.trades-scroll {
  flex: 1;
  max-height: 17rem;
  overflow-y: auto;
}

.trades table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}

.trades th {
  position: sticky;
  top: 0;
  padding: 0.1rem 0.35rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  font-weight: 600;
  color: var(--color-text-muted);
}

.trades th.num {
  text-align: right;
}

.trades td {
  padding: 0.08rem 0.35rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.trades .date {
  font-family: var(--font-mono);
  color: var(--color-text-muted);
}

.trades .side {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
}

.trades .side.buy,
.trades .long {
  color: var(--color-buy);
}

.trades .side.sell,
.trades .short {
  color: var(--color-sell);
}

.trades .flat {
  color: var(--color-text-muted);
}
</style>

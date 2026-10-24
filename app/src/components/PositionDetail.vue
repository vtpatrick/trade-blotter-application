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
import { formatPrice } from '@/utils/format'
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
    grid-template-columns: minmax(380px, 500px) minmax(0, 1fr);
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

/* Two panels side by side, stretched to the same height so their bottoms line up. */
.fields,
.history {
  min-width: 0;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { Trade, TradeSide } from '@/api/trades'
import { useBlotterStore } from '@/stores/blotter'
import QuickFilter from './QuickFilter.vue'
import { formatAmount, formatPrice, formatQuantity, formatTimestamp } from '@/utils/format'

type SortKey = 'timestamp' | 'symbol' | 'side' | 'quantity' | 'price' | 'notional'
type SortDirection = 'asc' | 'desc'

interface Column {
  key: SortKey
  label: string
  numeric?: boolean
  /** Direction used the first time the column is clicked. */
  firstDirection: SortDirection
}

const columns: Column[] = [
  { key: 'timestamp', label: 'Time', firstDirection: 'desc' },
  { key: 'symbol', label: 'Symbol', firstDirection: 'asc' },
  { key: 'side', label: 'Side', firstDirection: 'asc' },
  { key: 'quantity', label: 'Quantity', numeric: true, firstDirection: 'desc' },
  { key: 'price', label: 'Price', numeric: true, firstDirection: 'desc' },
  { key: 'notional', label: 'Notional', numeric: true, firstDirection: 'desc' },
]

const blotter = useBlotterStore()
const { trades, newTradeIds, loading } = storeToRefs(blotter)

const sortKey = ref<SortKey>('timestamp')
const sortDirection = ref<SortDirection>('desc')

function sortBy(column: Column) {
  if (sortKey.value === column.key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = column.key
    sortDirection.value = column.firstDirection
  }
}

function compare(a: Trade, b: Trade, key: SortKey): number {
  switch (key) {
    case 'timestamp':
      return Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id - b.id
    case 'symbol':
    case 'side':
      return a[key].localeCompare(b[key])
    default:
      return a[key] - b[key]
  }
}

// ---------- quick filters ----------
const search = ref('')
const side = ref<'all' | TradeSide>('all')
const period = ref<'all' | 'today' | '7d' | '30d'>('all')

const SIDES = [
  { value: 'all', label: 'All' },
  { value: 'Buy', label: 'Buy' },
  { value: 'Sell', label: 'Sell' },
] as const
const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
] as const

/** Earliest timestamp the period lets through (local midnight for "today"). */
function periodStart(p: typeof period.value): number {
  if (p === 'all') return -Infinity
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (p === '7d') start.setDate(start.getDate() - 6)
  if (p === '30d') start.setDate(start.getDate() - 29)
  return start.getTime()
}

const filteredTrades = computed(() => {
  const term = search.value.trim().toUpperCase()
  const from = periodStart(period.value)
  return trades.value.filter(
    (t) =>
      (!term || t.symbol.includes(term)) &&
      (side.value === 'all' || t.side === side.value) &&
      Date.parse(t.timestamp) >= from,
  )
})

const isFiltered = computed(
  () => search.value.trim() !== '' || side.value !== 'all' || period.value !== 'all',
)

const countLabel = computed(() => {
  const total = `${trades.value.length} ${trades.value.length === 1 ? 'trade' : 'trades'}`
  return isFiltered.value ? `${filteredTrades.value.length} of ${total}` : total
})

function clearFilters() {
  search.value = ''
  side.value = 'all'
  period.value = 'all'
}

const sortedTrades = computed(() => {
  const sign = sortDirection.value === 'asc' ? 1 : -1
  // Ties fall back to newest first so equal values stay in a predictable order.
  return [...filteredTrades.value].sort(
    (a, b) => sign * compare(a, b, sortKey.value) || compare(b, a, 'timestamp'),
  )
})

function ariaSort(column: Column) {
  if (sortKey.value !== column.key) return 'none'
  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
}
</script>

<template>
  <section class="card blotter">
    <h2 class="card-title">
      <span>Blotter</span>
      <span class="count">{{ countLabel }}</span>
    </h2>

    <div class="filter-bar filters">
      <input
        v-model="search"
        class="filter-search"
        type="search"
        placeholder="Filter symbol"
        aria-label="Filter trades by symbol"
      />
      <QuickFilter v-model="side" label="Side" :options="SIDES" />
      <QuickFilter v-model="period" label="Period" :options="PERIODS" />
      <button v-if="isFiltered" type="button" class="filter-clear" @click="clearFilters">
        Clear
      </button>
    </div>

    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              :class="{ num: column.numeric }"
              :aria-sort="ariaSort(column)"
            >
              <button type="button" class="sort" @click="sortBy(column)">
                {{ column.label }}
                <span class="arrow" aria-hidden="true">
                  {{ sortKey === column.key ? (sortDirection === 'asc' ? '▲' : '▼') : '' }}
                </span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="trade in sortedTrades"
            :key="trade.id"
            :class="[trade.side.toLowerCase(), { new: newTradeIds.has(trade.id) }]"
          >
            <td class="time" :title="new Date(trade.timestamp).toLocaleString()">
              {{ formatTimestamp(trade.timestamp) }}
            </td>
            <td class="symbol">{{ trade.symbol }}</td>
            <td>
              <span class="side-badge" :class="trade.side.toLowerCase()">{{ trade.side }}</span>
            </td>
            <td class="num">{{ formatQuantity(trade.quantity) }}</td>
            <td class="num">{{ formatPrice(trade.price) }}</td>
            <td class="num">{{ formatAmount(trade.notional) }}</td>
          </tr>
        </tbody>
      </table>

      <p v-if="sortedTrades.length === 0" class="empty">
        {{
          loading
            ? 'Loading trades…'
            : isFiltered
              ? 'No trades match the filters.'
              : 'No trades yet. Book one with the ticket.'
        }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.blotter {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.filters {
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.count {
  font-weight: 500;
  letter-spacing: normal;
  text-transform: none;
}

.scroll {
  overflow: auto;
  max-height: calc(100vh - 9rem);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: 0;
  text-align: left;
}

.sort {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 0;
  background: none;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
}

/* Arrow on the left for numeric columns so the label lines up with right-aligned values. */
th.num .sort {
  flex-direction: row-reverse;
  justify-content: flex-start;
}

th[aria-sort='ascending'] .sort,
th[aria-sort='descending'] .sort {
  color: var(--color-text);
}

.arrow {
  font-size: 0.65rem;
  min-width: 0.65rem;
}

td {
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

/* Side colour on the row edge makes runs of buys and sells visible while scrolling. */
tbody tr {
  box-shadow: inset 3px 0 0 var(--row-edge);
}

tbody tr.buy {
  --row-edge: var(--color-buy);
}

tbody tr.sell {
  --row-edge: var(--color-sell);
}

tbody tr:hover {
  background: var(--color-surface-muted);
}

tbody tr.new {
  animation: flash 2.5s ease-out;
}

@keyframes flash {
  from {
    background: var(--color-flash);
  }
}

.time {
  font-family: var(--font-mono);
  color: var(--color-text-muted);
}

.symbol {
  font-family: var(--font-mono);
  font-weight: 700;
}

.side-badge {
  display: inline-block;
  min-width: 3.2rem;
  padding: 0.05rem 0.45rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-align: center;
  text-transform: uppercase;
}

.side-badge.buy {
  background: var(--color-buy-bg);
  color: var(--color-buy);
}

.side-badge.sell {
  background: var(--color-sell-bg);
  color: var(--color-sell);
}
</style>

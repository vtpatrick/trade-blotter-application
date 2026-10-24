<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import PositionDetail from '@/components/PositionDetail.vue'
import QuickFilter from '@/components/QuickFilter.vue'
import { useLiveQuotes } from '@/composables/useLiveQuotes'
import { useBlotterStore } from '@/stores/blotter'
import {
  formatAmount,
  formatPrice,
  formatQuantity,
  formatSignedAmount,
  formatSignedPercent,
} from '@/utils/format'
import { summarize, valuePositions, type ValuedPosition } from '@/utils/valuePositions'

const { positions, loading } = storeToRefs(useBlotterStore())

// Live Bloomberg prices for every open position, from this desk's DeskLink.
const { quotes, status, error, updatedAt } = useLiveQuotes(() =>
  positions.value.map((p) => p.symbol),
)

const valued = computed(() => valuePositions(positions.value, quotes.value).rows)

// ---------- quick filters (they scope the totals as well as the table) ----------
const search = ref('')
const direction = ref<'all' | 'long' | 'short'>('all')
const pnl = ref<'all' | 'gainers' | 'losers'>('all')

const DIRECTIONS = [
  { value: 'all', label: 'All' },
  { value: 'long', label: 'Long' },
  { value: 'short', label: 'Short' },
] as const
const PNL = [
  { value: 'all', label: 'Any P&L' },
  { value: 'gainers', label: 'Gainers' },
  { value: 'losers', label: 'Losers' },
] as const

const filtered = computed(() => {
  const term = search.value.trim().toUpperCase()
  return valued.value.filter(
    (r) =>
      (!term || r.symbol.includes(term) || (r.name ?? '').toUpperCase().includes(term)) &&
      (direction.value === 'all' || (direction.value === 'long') === r.netQuantity > 0) &&
      (pnl.value === 'all' ||
        (r.unrealizedPnl !== null && (pnl.value === 'gainers') === r.unrealizedPnl > 0)),
  )
})

const isFiltered = computed(
  () => search.value.trim() !== '' || direction.value !== 'all' || pnl.value !== 'all',
)

function clearFilters() {
  search.value = ''
  direction.value = 'all'
  pnl.value = 'all'
}

// ---------- sorting ----------
type SortKey = keyof Pick<
  ValuedPosition,
  'symbol' | 'netQuantity' | 'marketValue' | 'unrealizedPnl' | 'unrealizedPercent' | 'dayPnl'
>

const columns: { key: SortKey | null; label: string; numeric?: boolean }[] = [
  { key: 'symbol', label: 'Symbol' },
  { key: null, label: 'Name' },
  { key: 'netQuantity', label: 'Net qty', numeric: true },
  { key: null, label: 'Avg cost', numeric: true },
  { key: null, label: 'Last', numeric: true },
  { key: null, label: 'Day', numeric: true },
  { key: 'marketValue', label: 'Market value', numeric: true },
  { key: 'unrealizedPnl', label: 'Unrealized P&L', numeric: true },
  { key: 'unrealizedPercent', label: 'Unrl %', numeric: true },
  { key: 'dayPnl', label: 'Day P&L', numeric: true },
]

const sortKey = ref<SortKey>('symbol')
const sortDirection = ref<'asc' | 'desc'>('asc')

function sortBy(key: SortKey | null) {
  if (!key) return
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDirection.value = key === 'symbol' ? 'asc' : 'desc'
  }
}

const rows = computed(() => {
  const sign = sortDirection.value === 'asc' ? 1 : -1
  const key = sortKey.value
  return [...filtered.value].sort((a, b) => {
    if (key === 'symbol') return sign * a.symbol.localeCompare(b.symbol)
    // Unpriced rows sink to the bottom whichever way the column is sorted.
    const x = a[key]
    const y = b[key]
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
    return sign * (x - y) || a.symbol.localeCompare(b.symbol)
  })
})

const totals = computed(() => summarize(filtered.value))

// ---------- expandable rows ----------
const expanded = ref(new Set<string>())

function toggle(symbol: string) {
  if (expanded.value.has(symbol)) expanded.value.delete(symbol)
  else expanded.value.add(symbol)
}

/** A click anywhere on the row expands it, except on its own buttons. */
function onRowClick(event: MouseEvent, symbol: string) {
  if ((event.target as HTMLElement).closest('button, a')) return
  toggle(symbol)
}

const pnlClass = (value: number | null) =>
  value === null || value === 0 ? '' : value > 0 ? 'gain' : 'loss'

const priceNote = computed(() => {
  switch (status.value) {
    case 'ready':
      return `Bloomberg live via DeskLink · updated ${updatedAt.value?.toLocaleTimeString() ?? ''}`
    case 'loading':
      return 'Fetching Bloomberg prices…'
    case 'unavailable':
      return 'Live prices unavailable; showing cost only'
    default:
      return ''
  }
})

function ariaSort(key: SortKey | null) {
  if (!key || sortKey.value !== key) return undefined
  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
}
</script>

<template>
  <div class="positions-page">
    <header class="page-header">
      <h1>Positions</h1>
      <p class="price-note" :class="status" :title="error ?? undefined">{{ priceNote }}</p>
    </header>

    <div class="filter-bar">
      <input
        v-model="search"
        class="filter-search"
        type="search"
        placeholder="Filter symbol or name"
        aria-label="Filter positions by symbol or name"
      />
      <QuickFilter v-model="direction" label="Direction" :options="DIRECTIONS" />
      <QuickFilter v-model="pnl" label="Unrealized P&L" :options="PNL" />
      <span class="filter-count">
        <template v-if="isFiltered">
          Showing {{ filtered.length }} of {{ valued.length }} ·
          <button type="button" class="filter-clear" @click="clearFilters">Clear</button>
        </template>
      </span>
    </div>

    <section class="summary" aria-label="Portfolio totals">
      <div class="card stat">
        <span class="stat-label">Open positions</span>
        <span class="stat-value">{{ totals.positions }}</span>
        <span class="stat-sub">{{ totals.longs }} long · {{ totals.shorts }} short</span>
      </div>
      <div class="card stat">
        <span class="stat-label">Long market value</span>
        <span class="stat-value num">{{ formatAmount(totals.longMarketValue) }}</span>
      </div>
      <div class="card stat">
        <span class="stat-label">Short market value</span>
        <span class="stat-value num">{{ formatAmount(totals.shortMarketValue) }}</span>
      </div>
      <div class="card stat">
        <span class="stat-label">Net exposure</span>
        <span class="stat-value num">{{ formatSignedAmount(totals.netExposure) }}</span>
        <span class="stat-sub num">gross {{ formatAmount(totals.grossExposure) }}</span>
      </div>
      <div class="card stat">
        <span class="stat-label">Unrealized P&amp;L</span>
        <span class="stat-value num" :class="pnlClass(totals.unrealizedPnl)">
          {{ formatSignedAmount(totals.unrealizedPnl) }}
        </span>
      </div>
      <div class="card stat">
        <span class="stat-label">Day P&amp;L</span>
        <span class="stat-value num" :class="pnlClass(totals.dayPnl)">
          {{ formatSignedAmount(totals.dayPnl) }}
        </span>
      </div>
    </section>

    <section class="card">
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th class="expand-col"><span class="visually-hidden">Details</span></th>
              <th
                v-for="column in columns"
                :key="column.label"
                :class="{ num: column.numeric }"
                :aria-sort="ariaSort(column.key)"
              >
                <button v-if="column.key" type="button" class="sort" @click="sortBy(column.key)">
                  {{ column.label }}
                  <span class="arrow" aria-hidden="true">
                    {{ sortKey === column.key ? (sortDirection === 'asc' ? '▲' : '▼') : '' }}
                  </span>
                </button>
                <span v-else class="plain">{{ column.label }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in rows" :key="row.symbol">
              <tr
                class="position-row"
                :class="[
                  row.netQuantity > 0 ? 'long' : 'short',
                  { open: expanded.has(row.symbol) },
                ]"
                @click="onRowClick($event, row.symbol)"
              >
                <td class="expand-col">
                  <button
                    type="button"
                    class="expand"
                    :aria-expanded="expanded.has(row.symbol)"
                    :aria-controls="`detail-${row.symbol}`"
                    :aria-label="`${expanded.has(row.symbol) ? 'Hide' : 'Show'} details for ${row.symbol}`"
                    @click="toggle(row.symbol)"
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4 4-4 4" /></svg>
                  </button>
                </td>
                <td class="symbol">{{ row.symbol }}</td>
                <td class="name" :title="row.name ?? undefined">{{ row.name ?? '—' }}</td>
                <td class="num">
                  {{ formatQuantity(row.netQuantity) }}
                  <span class="direction">{{ row.netQuantity > 0 ? 'Long' : 'Short' }}</span>
                </td>
                <td class="num">{{ formatPrice(row.averageCost) }}</td>
                <td class="num">{{ row.last === null ? '—' : formatPrice(row.last) }}</td>
                <td class="num" :class="pnlClass(row.dayChangePercent)">
                  {{
                    row.dayChangePercent === null ? '—' : formatSignedPercent(row.dayChangePercent)
                  }}
                </td>
                <td class="num">
                  {{ row.marketValue === null ? '—' : formatSignedAmount(row.marketValue) }}
                </td>
                <td class="num" :class="pnlClass(row.unrealizedPnl)">
                  {{ row.unrealizedPnl === null ? '—' : formatSignedAmount(row.unrealizedPnl) }}
                </td>
                <td class="num" :class="pnlClass(row.unrealizedPercent)">
                  {{
                    row.unrealizedPercent === null
                      ? '—'
                      : formatSignedPercent(row.unrealizedPercent)
                  }}
                </td>
                <td class="num" :class="pnlClass(row.dayPnl)">
                  {{ row.dayPnl === null ? '—' : formatSignedAmount(row.dayPnl) }}
                </td>
              </tr>
              <tr
                v-if="expanded.has(row.symbol)"
                :id="`detail-${row.symbol}`"
                class="detail-row"
                :class="row.netQuantity > 0 ? 'long' : 'short'"
              >
                <td :colspan="columns.length + 1">
                  <PositionDetail
                    :symbol="row.symbol"
                    :average-cost="row.averageCost"
                    :last="row.last"
                  />
                </td>
              </tr>
            </template>
          </tbody>
          <tfoot v-if="rows.length > 0">
            <tr>
              <td colspan="7">Total{{ isFiltered ? ' (filtered)' : '' }}</td>
              <td class="num">{{ formatSignedAmount(totals.netExposure) }}</td>
              <td class="num" :class="pnlClass(totals.unrealizedPnl)">
                {{ formatSignedAmount(totals.unrealizedPnl) }}
              </td>
              <td></td>
              <td class="num" :class="pnlClass(totals.dayPnl)">
                {{ formatSignedAmount(totals.dayPnl) }}
              </td>
            </tr>
          </tfoot>
        </table>

        <p v-if="rows.length === 0" class="empty">
          {{
            loading
              ? 'Loading positions…'
              : isFiltered
                ? 'No positions match the filters.'
                : 'No open positions.'
          }}
        </p>
      </div>
    </section>

    <p class="footnote">
      Positions are derived from the trade history (average cost method) and marked to Bloomberg
      last prices. Day P&amp;L assumes the position was held through the previous close. Click a row
      for its description and price history.
    </p>
  </div>
</template>

<style scoped>
.positions-page {
  display: grid;
  gap: 1rem;
}

.page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

h1 {
  font-size: 1.35rem;
}

.price-note {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.price-note.unavailable {
  color: var(--color-danger);
}

.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 0.75rem;
}

.stat {
  display: grid;
  gap: 0.15rem;
  padding: 0.75rem 1rem;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  text-align: left;
}

.stat-sub {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  text-align: left;
}

.scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  padding: 0;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  white-space: nowrap;
}

th.num {
  text-align: right;
}

.sort,
.plain {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.55rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.sort {
  width: 100%;
  border: 0;
  background: none;
}

th.num .sort {
  flex-direction: row-reverse;
}

th[aria-sort] .sort {
  color: var(--color-text);
}

.arrow {
  font-size: 0.65rem;
  min-width: 0.65rem;
}

td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

tbody tr {
  box-shadow: inset 3px 0 0 var(--row-edge);
}

tbody tr.long {
  --row-edge: var(--color-buy);
}

tbody tr.short {
  --row-edge: var(--color-sell);
}

tbody tr.position-row {
  cursor: pointer;
}

tbody tr.position-row:hover,
tbody tr.position-row.open {
  background: var(--color-surface-muted);
}

/* The expanded panel continues its row: same edge colour, no separator between them. */
tr.position-row.open td {
  border-bottom-color: transparent;
}

.detail-row td {
  padding: 0;
}

.expand-col {
  width: 2.25rem;
  padding-right: 0;
}

.expand {
  display: inline-grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--color-text-muted);
}

.expand:hover {
  background: var(--color-border);
  color: var(--color-text);
}

.expand svg {
  width: 0.9rem;
  height: 0.9rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.15s ease;
}

.expand[aria-expanded='true'] svg {
  transform: rotate(90deg);
}

tfoot td {
  border-bottom: 0;
  font-weight: 700;
}

.symbol {
  font-family: var(--font-mono);
  font-weight: 700;
}

.name {
  max-width: 16rem;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-text-muted);
}

.direction {
  margin-left: 0.35rem;
  font-family: var(--font-sans);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

tr.long .direction {
  color: var(--color-buy);
}

tr.short .direction {
  color: var(--color-sell);
}

.gain {
  color: var(--color-buy);
}

.loss {
  color: var(--color-sell);
}

.footnote {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>

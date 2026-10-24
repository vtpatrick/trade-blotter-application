<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { AgGridVue } from 'ag-grid-vue3'
import type {
  CellClassParams,
  ColDef,
  GridApi,
  GridReadyEvent,
  RowClassParams,
  RowClickedEvent,
  RowHeightParams,
} from 'ag-grid-community'
import { useLiveQuotes } from '@/composables/useLiveQuotes'
import { useCurrentTechnicals } from '@/composables/useTechnicals'
import { expressionFilter } from '@/grid/expressionFilter'
import { fitColumnsToWidth } from '@/grid/fitColumns'
import { spacerColumn } from '@/grid/spacerColumn'
import PositionDetailRow, { type DetailRowContext } from '@/grid/PositionDetailRow.vue'
import { keepDetailUnderParent, toGridRows, type PositionGridRow } from '@/grid/positionRows'
import { technicalColumnDefs } from '@/grid/technicalColumns'
import { gridTheme } from '@/grid/theme'
import { useBlotterStore } from '@/stores/blotter'
import {
  formatAmount,
  formatPrice,
  formatQuantity,
  formatSignedAmount,
  formatSignedPercent,
} from '@/utils/format'
import { technicalColumns } from '@/utils/technicals'
import { summarize, valuePositions, type ValuedPosition } from '@/utils/valuePositions'

const { positions, loading } = storeToRefs(useBlotterStore())

// Live Bloomberg prices for every open position, from this desk's DeskLink.
const { quotes, status, error, updatedAt } = useLiveQuotes(() =>
  positions.value.map((p) => p.symbol),
)

// Current Bloomberg technicals, refreshed every few minutes (they move slowly).
const { technicals } = useCurrentTechnicals(() => positions.value.map((p) => p.symbol))

/** Positions marked to the live price, with the technicals measured against that price. */
const valued = computed(() =>
  valuePositions(positions.value, quotes.value).rows.map((row) => ({
    ...row,
    ...technicalColumns(row.last, technicals.value.get(row.symbol)),
  })),
)

// ---------- expandable rows ----------
const expanded = ref(new Set<string>())
const rowData = computed(() => toGridRows(valued.value, expanded.value))

function toggle(symbol: string) {
  if (expanded.value.has(symbol)) expanded.value.delete(symbol)
  else expanded.value.add(symbol)
}

function onRowClicked(event: RowClickedEvent<PositionGridRow>) {
  if (event.data?.kind === 'position' && !event.rowPinned) toggle(event.data.symbol)
}

// ---------- columns ----------
/** First guess for a detail row; the row then sizes itself to its content (PositionDetailRow). */
const DETAIL_ROW_ESTIMATE = 330
const detailHeights = new Map<string, number>()
const gridContext: DetailRowContext = {
  rememberDetailHeight: (symbol, height) => detailHeights.set(symbol, height),
}

const pnlClass = (p: CellClassParams<PositionGridRow>) =>
  p.value === null || p.value === undefined || p.value === 0 ? '' : p.value > 0 ? 'gain' : 'loss'

/** Formats a value, "—" when there is none, and blank in the totals row for columns that do not total. */
const dash =
  (format: (v: number) => string) =>
  (p: { value: number | null | undefined; node: { rowPinned?: string | null } | null }) =>
    p.value === null || p.value === undefined ? (p.node?.rowPinned ? '' : '—') : format(p.value)

const num = (
  field: keyof ValuedPosition,
  headerName: string,
  width: number,
  extra: Partial<ColDef<PositionGridRow>> = {},
) =>
  ({
    field,
    headerName,
    // Equal starting width (fitColumnsToWidth scales them); `width` is the least the figures need.
    width: 100,
    minWidth: Math.min(width, 64),
    cellClass: 'cell-num',
    headerClass: 'cell-num',
    ...expressionFilter<PositionGridRow>('number', (r) => r[field]),
    ...extra,
  }) as ColDef<PositionGridRow>

const columnDefs: ColDef<PositionGridRow>[] = [
  {
    colId: 'expand',
    headerName: '',
    width: 30,
    resizable: false,
    sortable: false,
    suppressMovable: true,
    valueGetter: (p) => (p.data ? expanded.value.has(p.data.symbol) : false),
    cellRenderer: (p: { value: boolean; node: { rowPinned?: string | null } }) =>
      p.node.rowPinned
        ? ''
        : `<span class="expand-chevron${p.value ? ' open' : ''}" aria-hidden="true">›</span>`,
    cellClass: 'cell-expand',
  },
  {
    field: 'symbol',
    headerName: 'Symbol',
    width: 100,
    minWidth: 56,
    sort: 'asc',
    cellClass: 'cell-symbol',
    ...expressionFilter<PositionGridRow>('text', (r) => r.symbol),
  },
  {
    field: 'name',
    headerName: 'Name',
    width: 200,
    minWidth: 120,
    cellClass: 'cell-muted',
    valueFormatter: (p) => p.value ?? (p.node?.rowPinned ? '' : '—'),
    ...expressionFilter<PositionGridRow>('text', (r) => r.name),
  },
  num('netQuantity', 'Net qty', 104, {
    cellRenderer: (p: { value: number | null; node: { rowPinned?: string | null } }) =>
      p.value === null || p.node.rowPinned
        ? ''
        : `${formatQuantity(p.value)}<span class="direction ${p.value > 0 ? 'gain' : 'loss'}">${p.value > 0 ? 'L' : 'S'}</span>`,
  }),
  num('averageCost', 'Avg cost', 88, { valueFormatter: dash(formatPrice) }),
  num('last', 'Last', 82, { valueFormatter: dash(formatPrice), enableCellChangeFlash: true }),
  num('dayChangePercent', 'Day', 70, {
    valueFormatter: dash(formatSignedPercent),
    cellClassRules: { gain: (p) => (p.value ?? 0) > 0, loss: (p) => (p.value ?? 0) < 0 },
  }),
  num('marketValue', 'Mkt value', 104, {
    valueFormatter: dash(formatSignedAmount),
    enableCellChangeFlash: true,
  }),
  num('unrealizedPnl', 'Unrl P&L', 100, {
    valueFormatter: dash(formatSignedAmount),
    cellClassRules: { gain: (p) => pnlClass(p) === 'gain', loss: (p) => pnlClass(p) === 'loss' },
    enableCellChangeFlash: true,
  }),
  num('unrealizedPercent', 'Unrl %', 74, {
    valueFormatter: dash(formatSignedPercent),
    cellClassRules: { gain: (p) => pnlClass(p) === 'gain', loss: (p) => pnlClass(p) === 'loss' },
  }),
  num('dayPnl', 'Day P&L', 96, {
    valueFormatter: dash(formatSignedAmount),
    cellClassRules: { gain: (p) => pnlClass(p) === 'gain', loss: (p) => pnlClass(p) === 'loss' },
    enableCellChangeFlash: true,
  }),
  spacerColumn<PositionGridRow>(),
  ...technicalColumnDefs<PositionGridRow>(
    'Bloomberg, current; the averages are compared with the live price',
  ),
]

const defaultColDef: ColDef<PositionGridRow> = { sortable: true, resizable: true }

// Columns always fill the grid exactly (also after the user resizes one); spacer and chevron are fixed.
const fit = fitColumnsToWidth<PositionGridRow>({ spacer: 50, expand: 30 })

// ---------- grid wiring ----------
const api = shallowRef<GridApi<PositionGridRow>>()
/** Positions passing the column filters (no detail rows): what the totals and cards add up. */
const shownPositions = ref<ValuedPosition[]>([])
const isFiltered = ref(false)

function onGridReady(event: GridReadyEvent<PositionGridRow>) {
  api.value = event.api
  fit.onGridReady(event)
  refreshShown(event)
}

// Recount when the rows change (prices every 15 s, trades, expanding), once the grid has applied them.
watch(rowData, () => setTimeout(() => api.value && refreshShown({ api: api.value })))

/** Recount the positions passing the filters (on grid ready, filter changes and new rows). */
function refreshShown(event: { api: GridApi<PositionGridRow> }) {
  const shown: ValuedPosition[] = []
  event.api.forEachNodeAfterFilter((node) => {
    if (node.data?.kind === 'position') shown.push(node.data)
  })
  shownPositions.value = shown
  isFiltered.value = event.api.isAnyFilterPresent()
}

const totals = computed(() => summarize(shownPositions.value))

const pinnedBottomRowData = computed(() =>
  shownPositions.value.length === 0
    ? []
    : [
        {
          kind: 'position',
          symbol: isFiltered.value ? 'Total (filtered)' : 'Total',
          name: null,
          netQuantity: null,
          averageCost: null,
          costBasis: null,
          last: null,
          dayChangePercent: null,
          marketValue: totals.value.netExposure,
          unrealizedPnl: totals.value.unrealizedPnl,
          unrealizedPercent: null,
          dayPnl: totals.value.dayPnl,
        } as unknown as PositionGridRow,
      ],
)

const getRowId = (p: { data: PositionGridRow }) => `${p.data.kind}:${p.data.symbol}`
const isFullWidthRow = (p: { rowNode: { data?: PositionGridRow } }) =>
  p.rowNode.data?.kind === 'detail'
const getRowHeight = (p: RowHeightParams<PositionGridRow>) =>
  p.data?.kind === 'detail' ? (detailHeights.get(p.data.symbol) ?? DETAIL_ROW_ESTIMATE) : undefined
const rowClass = (p: RowClassParams<PositionGridRow>) =>
  p.data?.kind !== 'position' || p.node.rowPinned
    ? undefined
    : [p.data.netQuantity > 0 ? 'edge-buy' : 'edge-sell', 'clickable']
const postSortRows = (p: { nodes: Parameters<typeof keepDetailUnderParent>[0] }) =>
  keepDetailUnderParent(p.nodes)

const priceNote = computed(() => {
  switch (status.value) {
    case 'ready':
      return `Bloomberg live via DeskLink · ${updatedAt.value?.toLocaleTimeString() ?? ''}`
    case 'loading':
      return 'Fetching Bloomberg prices…'
    case 'unavailable':
      return 'Live prices unavailable; showing cost only'
    default:
      return ''
  }
})
</script>

<template>
  <div class="positions-page">
    <header class="page-header">
      <h1>Positions</h1>
      <p v-if="isFiltered" class="filter-count">
        Showing {{ shownPositions.length }} of {{ valued.length }} ·
        <button type="button" class="filter-clear" @click="api?.setFilterModel(null)">
          Clear filters
        </button>
      </p>
      <p class="price-note" :class="status" :title="error ?? undefined">
        {{ priceNote }}
      </p>
    </header>

    <section class="summary" aria-label="Portfolio totals">
      <div class="stat">
        <span class="stat-label">Positions</span>
        <span class="stat-value">{{ totals.positions }}</span>
        <span class="stat-sub">{{ totals.longs }}L · {{ totals.shorts }}S</span>
      </div>
      <div class="stat">
        <span class="stat-label">Long MV</span>
        <span class="stat-value num">{{ formatAmount(totals.longMarketValue) }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Short MV</span>
        <span class="stat-value num">{{ formatAmount(totals.shortMarketValue) }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Net exposure</span>
        <span class="stat-value num">{{ formatSignedAmount(totals.netExposure) }}</span>
        <span class="stat-sub num">gross {{ formatAmount(totals.grossExposure) }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Unrealized P&amp;L</span>
        <span
          class="stat-value num"
          :class="totals.unrealizedPnl > 0 ? 'gain' : totals.unrealizedPnl < 0 ? 'loss' : ''"
        >
          {{ formatSignedAmount(totals.unrealizedPnl) }}
        </span>
      </div>
      <div class="stat">
        <span class="stat-label">Day P&amp;L</span>
        <span
          class="stat-value num"
          :class="totals.dayPnl > 0 ? 'gain' : totals.dayPnl < 0 ? 'loss' : ''"
        >
          {{ formatSignedAmount(totals.dayPnl) }}
        </span>
      </div>
    </section>

    <section class="card grid-card">
      <AgGridVue
        class="grid"
        :theme="gridTheme"
        :row-data="rowData"
        :column-defs="columnDefs"
        :default-col-def="defaultColDef"
        :get-row-id="getRowId"
        :get-row-class="rowClass"
        :get-row-height="getRowHeight"
        :is-full-width-row="isFullWidthRow"
        :full-width-cell-renderer="PositionDetailRow"
        :context="gridContext"
        :post-sort-rows="postSortRows"
        :pinned-bottom-row-data="pinnedBottomRowData"
        :enable-filter-handlers="true"
        :animate-rows="false"
        :suppress-horizontal-scroll="true"
        :loading="loading && positions.length === 0"
        overlay-no-rows-template="No open positions."
        @grid-ready="onGridReady"
        @filter-changed="refreshShown"
        @row-clicked="onRowClicked"
        @first-data-rendered="fit.onFirstDataRendered"
        @row-data-updated="fit.onRowDataUpdated"
        @column-resized="fit.onColumnResized"
        @grid-size-changed="fit.onGridSizeChanged"
      />
    </section>

    <p class="footnote">
      Average cost method, marked to Bloomberg last. Day P&amp;L assumes the position was held
      through the previous close. Click a row for its description and price history.
    </p>
  </div>
</template>

<style scoped>
.positions-page {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 0.5rem;
  height: calc(100vh - 3.4rem);
}

.page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem 1rem;
}

h1 {
  font-size: 1rem;
}

.filter-count {
  margin-right: auto;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.price-note {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.price-note.unavailable {
  color: var(--color-danger);
}

/* One strip of figures rather than six cards. */
.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.stat {
  display: grid;
  align-content: start;
  gap: 0.05rem;
  padding: 0.35rem 0.65rem;
  border-left: 1px solid var(--color-border);
}

.stat:first-child {
  border-left: 0;
}

.stat-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.stat-value {
  font-size: 0.95rem;
  font-weight: 700;
  text-align: left;
}

.stat-sub {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-align: left;
}

.gain {
  color: var(--color-buy);
}

.loss {
  color: var(--color-sell);
}

.grid-card {
  min-height: 16rem;
  overflow: hidden;
}

.footnote {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}
</style>

<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { AgGridVue } from 'ag-grid-vue3'
import type { ColDef, GridApi, GridReadyEvent, RowClassParams } from 'ag-grid-community'
import type { Trade } from '@/api/trades'
import { useTradeTechnicals } from '@/composables/useTechnicals'
import { expressionFilter } from '@/grid/expressionFilter'
import { spacerColumn } from '@/grid/spacerColumn'
import { technicalColumnDefs } from '@/grid/technicalColumns'
import { gridTheme } from '@/grid/theme'
import { useBlotterStore } from '@/stores/blotter'
import { formatAmount, formatPrice, formatQuantity, formatTimestamp } from '@/utils/format'
import { NO_TECHNICALS, type TechnicalColumns } from '@/utils/technicals'

const blotter = useBlotterStore()
const { trades, newTradeIds, loading } = storeToRefs(blotter)

/** A trade plus Bloomberg's technicals on its trade date. */
type TradeRow = Trade & TechnicalColumns

const { byTrade, status: technicalsStatus } = useTradeTechnicals(() => trades.value)
const rowData = computed<TradeRow[]>(() =>
  trades.value.map((t) => ({ ...t, ...(byTrade.value.get(t.id) ?? NO_TECHNICALS) })),
)

/** The trade's date as YYYY-MM-DD in the viewer's time zone, matching what the Time column shows. */
const localDate = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const columnDefs: ColDef<TradeRow>[] = [
  {
    headerName: 'Time',
    field: 'timestamp',
    sort: 'desc',
    flex: 1.4,
    minWidth: 140,
    cellClass: 'cell-mono cell-muted',
    valueFormatter: (p) => (p.value ? formatTimestamp(p.value) : ''),
    tooltipValueGetter: (p) => (p.value ? new Date(p.value).toLocaleString() : ''),
    comparator: (a: string, b: string, nodeA, nodeB) =>
      Date.parse(a) - Date.parse(b) || (nodeA.data?.id ?? 0) - (nodeB.data?.id ?? 0),
    ...expressionFilter<TradeRow>('date', (t) => localDate.format(new Date(t.timestamp))),
  },
  {
    headerName: 'Symbol',
    field: 'symbol',
    flex: 1,
    minWidth: 84,
    cellClass: 'cell-symbol',
    ...expressionFilter<TradeRow>('text', (t) => t.symbol),
  },
  {
    headerName: 'Side',
    field: 'side',
    flex: 0.8,
    minWidth: 76,
    // Values are only ever Buy or Sell (validated by the API), so the markup is safe.
    cellRenderer: (p: { value: Trade['side'] }) =>
      `<span class="side-badge ${p.value === 'Buy' ? 'buy' : 'sell'}">${p.value === 'Buy' ? 'Buy' : 'Sell'}</span>`,
    ...expressionFilter<TradeRow>('text', (t) => t.side),
  },
  {
    headerName: 'Quantity',
    field: 'quantity',
    flex: 1,
    minWidth: 100,
    cellClass: 'cell-num',
    headerClass: 'cell-num',
    valueFormatter: (p) => formatQuantity(p.value),
    ...expressionFilter<TradeRow>('number', (t) => t.quantity),
  },
  {
    headerName: 'Price',
    field: 'price',
    flex: 1,
    minWidth: 100,
    cellClass: 'cell-num',
    headerClass: 'cell-num',
    valueFormatter: (p) => formatPrice(p.value),
    ...expressionFilter<TradeRow>('number', (t) => t.price),
  },
  {
    headerName: 'Notional',
    field: 'notional',
    flex: 1.2,
    minWidth: 120,
    cellClass: 'cell-num',
    headerClass: 'cell-num',
    valueFormatter: (p) => formatAmount(p.value),
    ...expressionFilter<TradeRow>('number', (t) => t.notional),
  },
  spacerColumn<TradeRow>(),
  ...technicalColumnDefs<TradeRow>(
    'Bloomberg, on the trade date (the last close before it for a trade booked today)',
  ),
]

// Trade columns share all the width up to the Bloomberg group, which is pinned to the right edge.
const defaultColDef: ColDef<TradeRow> = { sortable: true, resizable: true }

const api = shallowRef<GridApi<TradeRow>>()
const shown = ref(0)
const isFiltered = ref(false)

function onGridReady(event: GridReadyEvent<TradeRow>) {
  api.value = event.api
  refreshCount()
}

function refreshCount() {
  if (!api.value) return
  shown.value = api.value.getDisplayedRowCount()
  isFiltered.value = api.value.isAnyFilterPresent()
}

// Briefly highlight trades that arrived after the first load (own submissions and broadcasts).
const flashed = new Set<number>()
function onRowDataUpdated() {
  refreshCount()
  const nodes = [...newTradeIds.value]
    .filter((id) => !flashed.has(id))
    .map((id) => {
      flashed.add(id)
      return api.value?.getRowNode(String(id))
    })
    .filter((n) => n !== undefined)
  if (nodes.length)
    api.value?.flashCells({ rowNodes: nodes, flashDuration: 1500, fadeDuration: 1000 })
}

const countLabel = computed(() => {
  const total = `${trades.value.length} ${trades.value.length === 1 ? 'trade' : 'trades'}`
  return isFiltered.value ? `${shown.value} of ${total}` : total
})

const getRowId = (p: { data: TradeRow }) => String(p.data.id)
const rowClass = (p: RowClassParams<TradeRow>) =>
  p.data?.side === 'Buy' ? 'edge-buy' : 'edge-sell'
</script>

<template>
  <section class="card blotter">
    <h2 class="card-title">
      <span>Blotter</span>
      <span class="count">
        <span
          v-if="technicalsStatus === 'unavailable'"
          class="technicals-note"
          title="Bloomberg technicals at trade time could not be loaded (DeskLink / Bloomberg)"
        >
          Technicals unavailable ·
        </span>
        {{ countLabel }}
        <button
          v-if="isFiltered"
          type="button"
          class="filter-clear"
          @click="api?.setFilterModel(null)"
        >
          Clear filters
        </button>
      </span>
    </h2>

    <AgGridVue
      class="grid"
      :theme="gridTheme"
      :row-data="rowData"
      :column-defs="columnDefs"
      :default-col-def="defaultColDef"
      :get-row-id="getRowId"
      :get-row-class="rowClass"
      :enable-filter-handlers="true"
      :animate-rows="false"
      :loading="loading && trades.length === 0"
      :tooltip-show-delay="400"
      overlay-no-rows-template="No trades yet. Book one with the ticket."
      @grid-ready="onGridReady"
      @filter-changed="refreshCount"
      @row-data-updated="onRowDataUpdated"
    />
  </section>
</template>

<style scoped>
.blotter {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 70vh;
  overflow: hidden;
}

.grid {
  flex: 1;
  min-height: 0;
}

.technicals-note {
  color: var(--color-danger);
}

.count {
  display: inline-flex;
  align-items: baseline;
  gap: 0.6rem;
  font-weight: 500;
  letter-spacing: normal;
  text-transform: none;
}
</style>

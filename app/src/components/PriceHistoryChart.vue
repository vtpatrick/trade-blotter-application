<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import type { PricePoint } from '@/api/bloomberg'
import type { TradeSide } from '@/api/trades'
import { formatPrice, formatQuantity, formatSignedPercent } from '@/utils/format'

export interface ChartTrade {
  /** YYYY-MM-DD, New York trading date. */
  date: string
  side: TradeSide
  quantity: number
  price: number
}

const props = defineProps<{
  symbol: string
  points: PricePoint[]
  averageCost: number | null
  trades: ChartTrade[]
}>()

const RANGES = [1, 2, 3, 5] as const
const years = ref<(typeof RANGES)[number]>(1)

// ---------- size ----------
const HEIGHT = 260
const M = { top: 12, right: 58, bottom: 24, left: 8 }
const frame = useTemplateRef<HTMLDivElement>('frame')
const width = ref(640)
let observer: ResizeObserver | undefined
onMounted(() => {
  // No ResizeObserver (old browsers, test DOMs): keep the default width.
  if (!frame.value || typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(280, Math.round(entry.contentRect.width))
  })
  observer.observe(frame.value)
})
onBeforeUnmount(() => observer?.disconnect())

// ---------- data in range ----------
const visible = computed(() => {
  const last = props.points[props.points.length - 1]
  if (!last) return []
  const cutoff = new Date(`${last.date}T00:00:00Z`)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years.value)
  const from = cutoff.toISOString().slice(0, 10)
  return props.points.filter((p) => p.date > from)
})

const indexByDate = computed(() => new Map(visible.value.map((p, i) => [p.date, i])))

/** Trades in range, placed on their session (or the next one, if their date had no bar). */
const markers = computed(() => {
  const pts = visible.value
  if (pts.length === 0) return []
  return props.trades
    .filter((t) => t.date >= pts[0]!.date && t.date <= pts[pts.length - 1]!.date)
    .map((t) => {
      const index = indexByDate.value.get(t.date) ?? pts.findIndex((p) => p.date >= t.date)
      return { ...t, index }
    })
    .filter((t) => t.index >= 0)
})

// ---------- scales ----------
const plotW = computed(() => width.value - M.left - M.right)
const plotH = HEIGHT - M.top - M.bottom

const yDomain = computed(() => {
  const values = visible.value.map((p) => p.close)
  if (props.averageCost !== null) values.push(props.averageCost)
  for (const m of markers.value) values.push(m.price)
  if (values.length === 0) return [0, 1] as const
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = (hi - lo || hi || 1) * 0.06
  return [lo - pad, hi + pad] as const
})

const x = (i: number) =>
  M.left + (visible.value.length <= 1 ? 0 : (i / (visible.value.length - 1)) * plotW.value)
const y = (v: number) => {
  const [lo, hi] = yDomain.value
  return M.top + (1 - (v - lo) / (hi - lo)) * plotH
}

function niceTicks(lo: number, hi: number, count = 4) {
  const raw = (hi - lo) / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(Number(v.toFixed(10)))
  return ticks
}

const yTicks = computed(() => niceTicks(yDomain.value[0], yDomain.value[1]))

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const xTicks = computed(() => {
  const step = { 1: 2, 2: 3, 3: 6, 5: 12 }[years.value]
  const ticks: { index: number; label: string }[] = []
  visible.value.forEach((p, i) => {
    const prev = visible.value[i - 1]
    if (!prev || prev.date.slice(0, 7) === p.date.slice(0, 7)) return // first session of a month only
    const month = Number(p.date.slice(5, 7)) - 1
    if (month % step !== 0) return
    const yy = p.date.slice(2, 4)
    const label =
      step === 12
        ? p.date.slice(0, 4)
        : years.value === 1
          ? MONTHS[month]!
          : `${MONTHS[month]} '${yy}`
    ticks.push({ index: i, label })
  })
  return ticks
})

const linePath = computed(() =>
  visible.value
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.close).toFixed(1)}`)
    .join(''),
)
const areaPath = computed(() => {
  if (visible.value.length < 2) return ''
  const base = (M.top + plotH).toFixed(1)
  return `${linePath.value}L${x(visible.value.length - 1).toFixed(1)},${base}L${x(0).toFixed(1)},${base}Z`
})

const triangle = (cx: number, cy: number, up: boolean) => {
  const s = 5.5
  return up
    ? `M${cx},${cy - s}L${cx + s},${cy + s * 0.8}L${cx - s},${cy + s * 0.8}Z`
    : `M${cx},${cy + s}L${cx + s},${cy - s * 0.8}L${cx - s},${cy - s * 0.8}Z`
}

// ---------- summary (the text alternative to the picture) ----------
const summary = computed(() => {
  const pts = visible.value
  if (pts.length < 2) return null
  const closes = pts.map((p) => p.close)
  return {
    change: (pts[pts.length - 1]!.close / pts[0]!.close - 1) * 100,
    high: Math.max(...closes),
    low: Math.min(...closes),
    from: pts[0]!.date,
    to: pts[pts.length - 1]!.date,
  }
})

// ---------- hover / keyboard crosshair ----------
const active = ref<number | null>(null)

function onPointerMove(event: PointerEvent) {
  const svg = event.currentTarget as SVGElement
  const box = svg.getBoundingClientRect()
  const px = ((event.clientX - box.left) / box.width) * width.value
  const ratio = (px - M.left) / plotW.value
  active.value = Math.min(
    visible.value.length - 1,
    Math.max(0, Math.round(ratio * (visible.value.length - 1))),
  )
}

function onKeydown(event: KeyboardEvent) {
  const last = visible.value.length - 1
  if (last < 0) return
  const moves: Record<string, () => number> = {
    ArrowLeft: () => Math.max(0, (active.value ?? last) - 1),
    ArrowRight: () => Math.min(last, (active.value ?? last) + 1),
    Home: () => 0,
    End: () => last,
  }
  if (event.key === 'Escape') {
    active.value = null
  } else if (moves[event.key]) {
    event.preventDefault()
    active.value = moves[event.key]!()
  }
}

const tooltip = computed(() => {
  if (active.value === null) return null
  const point = visible.value[active.value]
  if (!point) return null
  const left = x(active.value)
  return {
    point,
    left,
    flip: left > width.value * 0.65,
    trades: markers.value.filter((m) => m.index === active.value),
  }
})

const formatDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
</script>

<template>
  <figure class="chart">
    <figcaption class="chart-head">
      <div>
        <span class="chart-title">{{ symbol }} daily close</span>
        <span class="key">
          <span class="key-item"><span class="key-avg" aria-hidden="true"></span>Avg cost</span>
          <span class="key-item"><span class="buy" aria-hidden="true">▲</span>Buy</span>
          <span class="key-item"><span class="sell" aria-hidden="true">▼</span>Sell</span>
        </span>
      </div>
      <div class="ranges" role="group" aria-label="Chart range">
        <button
          v-for="r in RANGES"
          :key="r"
          type="button"
          :aria-pressed="years === r"
          @click="((years = r), (active = null))"
        >
          {{ r }}Y
        </button>
      </div>
    </figcaption>

    <div
      ref="frame"
      class="frame"
      tabindex="0"
      :aria-label="`${symbol} price history; use the arrow keys to read values`"
      @keydown="onKeydown"
      @blur="active = null"
    >
      <svg
        :viewBox="`0 0 ${width} ${HEIGHT}`"
        :width="width"
        :height="HEIGHT"
        role="img"
        :aria-label="`${symbol} daily closing price, last ${years} year${years > 1 ? 's' : ''}`"
        @pointermove="onPointerMove"
        @pointerleave="active = null"
      >
        <g class="grid">
          <line
            v-for="t in yTicks"
            :key="t"
            :x1="M.left"
            :x2="M.left + plotW"
            :y1="y(t)"
            :y2="y(t)"
          />
        </g>
        <g class="axis">
          <text v-for="t in yTicks" :key="t" :x="M.left + plotW + 6" :y="y(t) + 4">
            {{ formatPrice(t) }}
          </text>
          <text
            v-for="t in xTicks"
            :key="t.index"
            :x="x(t.index)"
            :y="HEIGHT - 6"
            text-anchor="middle"
          >
            {{ t.label }}
          </text>
        </g>

        <path class="area" :d="areaPath" />
        <path class="line" :d="linePath" />

        <g v-if="averageCost !== null" class="avg">
          <line :x1="M.left" :x2="M.left + plotW" :y1="y(averageCost)" :y2="y(averageCost)" />
          <text :x="M.left + 4" :y="y(averageCost) - 5">Avg {{ formatPrice(averageCost) }}</text>
        </g>

        <path
          v-for="(m, i) in markers"
          :key="i"
          class="marker"
          :class="m.side.toLowerCase()"
          :d="triangle(x(m.index), y(m.price), m.side === 'Buy')"
        />

        <g v-if="tooltip" class="crosshair">
          <line :x1="tooltip.left" :x2="tooltip.left" :y1="M.top" :y2="M.top + plotH" />
          <circle :cx="tooltip.left" :cy="y(tooltip.point.close)" r="4" />
        </g>
      </svg>

      <div
        v-if="tooltip"
        class="tooltip"
        :class="{ flip: tooltip.flip }"
        :style="{ left: `${tooltip.left}px` }"
        role="status"
      >
        <strong class="num">{{ formatPrice(tooltip.point.close) }}</strong>
        <span>{{ formatDay(tooltip.point.date) }}</span>
        <span v-for="(t, i) in tooltip.trades" :key="i" class="tip-trade">
          <span :class="t.side.toLowerCase()" aria-hidden="true">{{
            t.side === 'Buy' ? '▲' : '▼'
          }}</span>
          {{ t.side }} {{ formatQuantity(t.quantity) }} @ {{ formatPrice(t.price) }}
        </span>
      </div>
    </div>

    <p v-if="summary" class="summary">
      {{ formatDay(summary.from) }} – {{ formatDay(summary.to) }}:
      <strong :class="summary.change >= 0 ? 'gain' : 'loss'">{{
        formatSignedPercent(summary.change)
      }}</strong>
      · high {{ formatPrice(summary.high) }} · low {{ formatPrice(summary.low) }}
    </p>
  </figure>
</template>

<style scoped>
.chart {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  min-width: 0;
}

.chart-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.chart-title {
  font-weight: 600;
  margin-right: 0.75rem;
}

.key {
  display: inline-flex;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.key-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.key-avg {
  display: inline-block;
  width: 14px;
  border-top: 1px solid var(--color-text-muted);
}

.buy {
  color: var(--color-buy);
}

.sell {
  color: var(--color-sell);
}

.ranges {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.ranges button {
  padding: 0.2rem 0.6rem;
  border: 0;
  background: none;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.ranges button + button {
  border-left: 1px solid var(--color-border);
}

.ranges button[aria-pressed='true'] {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.frame {
  position: relative;
  min-width: 0;
  border-radius: var(--radius);
}

svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.grid line {
  stroke: var(--color-border);
  stroke-width: 1;
}

.axis text {
  fill: var(--color-text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.area {
  fill: var(--color-accent);
  opacity: 0.1;
}

.line {
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.avg line {
  stroke: var(--color-text-muted);
  stroke-width: 1;
}

.avg text {
  fill: var(--color-text-muted);
  font-size: 11px;
  font-weight: 600;
}

/* Trade markers: shape (▲/▼) carries the side as well as colour; the surface ring keeps them clear of the line. */
.marker {
  stroke: var(--color-surface);
  stroke-width: 2;
  paint-order: stroke;
}

.marker.buy {
  fill: var(--color-buy);
}

.marker.sell {
  fill: var(--color-sell);
}

.crosshair line {
  stroke: var(--color-text-muted);
  stroke-width: 1;
}

.crosshair circle {
  fill: var(--color-accent);
  stroke: var(--color-surface);
  stroke-width: 2;
}

.tooltip {
  position: absolute;
  top: 0;
  z-index: 2;
  display: grid;
  gap: 0.1rem;
  min-width: 8rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  font-size: 0.8rem;
  color: var(--color-text-muted);
  transform: translateX(12px);
  pointer-events: none;
}

.tooltip.flip {
  transform: translateX(calc(-100% - 12px));
}

.tooltip strong {
  font-size: 0.95rem;
  color: var(--color-text);
  text-align: left;
}

.tip-trade {
  color: var(--color-text);
}

.summary {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.gain {
  color: var(--color-buy);
}

.loss {
  color: var(--color-sell);
}
</style>

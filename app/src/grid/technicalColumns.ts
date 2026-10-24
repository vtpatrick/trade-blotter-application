import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TechnicalColumns } from '@/utils/technicals'
import { expressionFilter } from './expressionFilter'

const signed1 = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`

/** "—" when there is no figure, blank in a pinned totals row. */
const show =
  (format: (v: number) => string) =>
  (p: ValueFormatterParams): string =>
    p.value === null || p.value === undefined ? (p.node?.rowPinned ? '' : '—') : format(p.value)

const signClasses = {
  gain: (p: { value: number | null }) => (p.value ?? 0) > 0,
  loss: (p: { value: number | null }) => (p.value ?? 0) < 0,
}

/**
 * Bloomberg's RSI(14), price against the 50- and 200-day averages, and 30-day volatility, as
 * columns pinned to the right edge (no group header row). `source` says where the figures come
 * from and is added to each header's tooltip. Rows carry the figures as fields (utils/technicals.ts).
 */
export function technicalColumnDefs<T extends TechnicalColumns>(source: string): ColDef<T>[] {
  const column = (
    field: keyof TechnicalColumns,
    header: string,
    width: number,
    tooltip: string,
    extra: Partial<ColDef<T>>,
  ) =>
    ({
      field,
      headerName: header,
      headerTooltip: `${tooltip}. ${source}`,
      width,
      // Bloomberg's figures sit at the right edge, apart from the trade or position data.
      pinned: 'right',
      cellClass: 'cell-num',
      headerClass: 'cell-num',
      ...expressionFilter<T>('number', (row) => row[field]),
      ...extra,
    }) as ColDef<T>

  return [
    column('rsi14', 'RSI', 68, 'RSI, 14-day. 70 and above is overbought, 30 and below oversold.', {
      valueFormatter: show((v) => v.toFixed(1)),
      cellClassRules: {
        'rsi-high': (p) => (p.value ?? 0) >= 70,
        'rsi-low': (p) => p.value !== null && p.value !== undefined && p.value <= 30,
      },
    }),
    column('vsMa50', 'vs 50D', 80, 'Price against the 50-day moving average', {
      valueFormatter: show(signed1),
      cellClassRules: signClasses,
    }),
    column('vsMa200', 'vs 200D', 84, 'Price against the 200-day moving average', {
      valueFormatter: show(signed1),
      cellClassRules: signClasses,
    }),
    column('vol30', 'Vol 30D', 80, '30-day historical volatility, annualised', {
      valueFormatter: show((v) => `${v.toFixed(1)}%`),
    }),
  ]
}

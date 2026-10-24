import type { ColDef, DoesFilterPassParams } from 'ag-grid-community'
import { compileFilter, type CompiledFilter, type FilterKind } from '@/utils/columnFilter'
import ExpressionFilterInput from './ExpressionFilterInput.vue'

/** filterParams for an expression-filtered column: the filter reads `value(row)`, not the cell text. */
export interface ExpressionFilterParams<T> {
  kind: FilterKind
  value: (row: T) => unknown
}

// The grid calls doesFilterPass for every row; compile each expression once.
const compiled = new Map<string, CompiledFilter | null>()
function compile(expression: string, kind: FilterKind) {
  const key = `${kind}\u0000${expression}`
  if (!compiled.has(key)) compiled.set(key, compileFilter(expression, kind))
  return compiled.get(key)!
}

/**
 * Column settings that give a column the expression filter (see utils/columnFilter.ts) as its
 * AG Grid filter, typed in the floating filter row under the header. The filter's model is the
 * expression string; the input only reports an expression to the grid once it is valid.
 */
export function expressionFilter<T>(
  kind: FilterKind,
  value: (row: T) => unknown,
): Partial<ColDef<T>> {
  return {
    filter: {
      component: ExpressionFilterInput,
      doesFilterPass: ({ model, node }: DoesFilterPassParams<T, unknown, string>) => {
        const filter = compile(model, kind)
        return !filter || !filter.ok || (node.data !== undefined && filter.test(value(node.data)))
      },
    },
    filterParams: { kind, value } satisfies ExpressionFilterParams<T>,
    floatingFilter: true,
    floatingFilterComponent: ExpressionFilterInput,
    // The typed expression is the whole filter: no funnel buttons beside it or in the header.
    suppressFloatingFilterButton: true,
    suppressHeaderFilterButton: true,
  }
}

import type { Column, ColumnResizedEvent, GridApi, IColumnLimit } from 'ag-grid-community'

/**
 * Keeps a grid's columns filling its width exactly, so row rules always run edge to edge and no
 * blank band opens up beside the last column.
 *
 * - Every column starts from the same width and the grid scales them to fit, so they share the
 *   space evenly unless a column's minimum (its content) needs more.
 * - Columns the user drags keep the width they were given; the remaining columns absorb the
 *   difference in proportion. At least one column is always left free to absorb it (if the user has
 *   sized every column, their oldest choice is released), so a gap can never open.
 * - The total never exceeds the grid's width: if the user's widths would push it over, their older
 *   choices are released and then the latest is trimmed until everything fits. No sideways scroll.
 * - The grid refits when it is created, when its rows change (a vertical scrollbar can appear or go
 *   away), when it is resized and after every drag.
 * - `fixedWidths` columns (spacer, expand chevron) never change.
 */
export function fitColumnsToWidth<T>(fixedWidths: Record<string, number>) {
  const fixedIds = new Set(Object.keys(fixedWidths))
  /** Widths the user chose, oldest first. */
  const userWidths = new Map<string, number>()

  const limits = (): IColumnLimit[] =>
    [...Object.entries(fixedWidths), ...userWidths].map(([key, width]) => ({
      key,
      minWidth: width,
      maxWidth: width,
    }))

  const totalWidth = (api: GridApi<T>) =>
    api.getAllDisplayedColumns().reduce((sum, column) => sum + column.getActualWidth(), 0)

  function fit(api: GridApi<T>) {
    if (api.isDestroyed()) return
    for (let attempt = 0; attempt < 20; attempt++) {
      api.sizeColumnsToFit({ columnLimits: limits() })
      const { left, right } = api.getHorizontalPixelRange()
      const overflow = totalWidth(api) - (right - left)
      if (overflow <= 1 || userWidths.size === 0) return
      // Too wide for the grid: release the oldest user width, or trim the only one left.
      const ids = [...userWidths.keys()]
      const latest = ids[ids.length - 1]!
      if (ids.length > 1) {
        userWidths.delete(ids[0]!)
      } else {
        const minimum = api.getColumn(latest)?.getMinWidth() ?? 0
        const trimmed = userWidths.get(latest)! - overflow
        if (trimmed > minimum) userWidths.set(latest, trimmed)
        else userWidths.delete(latest)
      }
    }
  }

  function onColumnResized(event: ColumnResizedEvent<T>) {
    if (!event.finished || event.source !== 'uiColumnResized') return
    const resized = (event.columns ?? []).map((column: Column) => column.getColId())
    for (const column of event.columns ?? []) {
      userWidths.delete(column.getColId()) // re-insert as the newest choice
      userWidths.set(column.getColId(), column.getActualWidth())
    }
    const free = event.api
      .getAllDisplayedColumns()
      .filter((c) => !fixedIds.has(c.getColId()) && !userWidths.has(c.getColId()))
    if (free.length === 0) {
      const oldest = [...userWidths.keys()].find((id) => !resized.includes(id))
      if (oldest !== undefined) userWidths.delete(oldest)
    }
    fit(event.api)
  }

  const refit = (event: { api: GridApi<T> }) => fit(event.api)

  return {
    onColumnResized,
    onGridReady: refit,
    onFirstDataRendered: refit,
    onRowDataUpdated: refit,
    onGridSizeChanged: refit,
  }
}

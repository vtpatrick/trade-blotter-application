import type { ColDef } from 'ag-grid-community'

/**
 * A 50px empty column separating a grid's own data from the Bloomberg block pinned on the right.
 * It is a real column, so row rules and hover run straight through it.
 */
export function spacerColumn<T>(): ColDef<T> {
  return {
    colId: 'spacer',
    headerName: '',
    width: 50,
    sortable: false,
    resizable: false,
    suppressMovable: true,
    suppressHeaderMenuButton: true,
    filter: false,
    floatingFilter: false,
    suppressNavigable: true,
    valueGetter: () => null,
    cellClass: 'cell-spacer',
    headerClass: 'cell-spacer',
  }
}

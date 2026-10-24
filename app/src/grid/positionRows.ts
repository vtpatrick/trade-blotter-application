import type { IRowNode } from 'ag-grid-community'
import type { TechnicalColumns } from '@/utils/technicals'
import type { ValuedPosition } from '@/utils/valuePositions'

/**
 * A grid row on the Positions page. An expanded position is followed by a full-width "detail"
 * row carrying the same values, so filters and sorting treat the pair identically; postSortRows
 * then puts each detail row straight back under its position.
 */
export type PositionGridRow = ValuedPosition & TechnicalColumns & { kind: 'position' | 'detail' }

export function toGridRows(
  positions: (ValuedPosition & TechnicalColumns)[],
  expanded: ReadonlySet<string>,
): PositionGridRow[] {
  return positions.flatMap((p) =>
    expanded.has(p.symbol)
      ? [
          { ...p, kind: 'position' as const },
          { ...p, kind: 'detail' as const },
        ]
      : [{ ...p, kind: 'position' as const }],
  )
}

/** Re-attach each detail row directly below its position after the grid sorts. In place. */
export function keepDetailUnderParent(nodes: IRowNode<PositionGridRow>[]) {
  const details = new Map(
    nodes.filter((n) => n.data?.kind === 'detail').map((n) => [n.data!.symbol, n]),
  )
  if (details.size === 0) return
  const ordered: IRowNode<PositionGridRow>[] = []
  for (const node of nodes) {
    if (node.data?.kind === 'detail') continue
    ordered.push(node)
    const detail = node.data && details.get(node.data.symbol)
    if (detail) ordered.push(detail)
  }
  nodes.splice(0, nodes.length, ...ordered)
}

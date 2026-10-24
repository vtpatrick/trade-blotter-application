import { describe, expect, it } from 'vitest'
import type { IRowNode } from 'ag-grid-community'
import type { ValuedPosition } from '@/utils/valuePositions'
import { keepDetailUnderParent, toGridRows, type PositionGridRow } from '../positionRows'

const position = (symbol: string): ValuedPosition => ({
  symbol,
  name: null,
  netQuantity: 1,
  averageCost: 1,
  costBasis: 1,
  last: null,
  dayChangePercent: null,
  marketValue: null,
  unrealizedPnl: null,
  unrealizedPercent: null,
  dayPnl: null,
})

const node = (row: PositionGridRow) => ({ data: row }) as IRowNode<PositionGridRow>
const describeNodes = (nodes: IRowNode<PositionGridRow>[]) =>
  nodes.map((n) => `${n.data!.kind}:${n.data!.symbol}`)

describe('positionRows', () => {
  it('adds a detail row after each expanded position only', () => {
    const rows = toGridRows([position('KO'), position('PEP')], new Set(['KO']))

    expect(rows.map((r) => `${r.kind}:${r.symbol}`)).toEqual([
      'position:KO',
      'detail:KO',
      'position:PEP',
    ])
  })

  it('puts each detail row straight back under its position after a sort', () => {
    // As a sort could leave them: details separated from, or ahead of, their positions.
    const nodes = [
      { kind: 'detail', symbol: 'PEP' },
      { kind: 'position', symbol: 'WMT' },
      { kind: 'position', symbol: 'KO' },
      { kind: 'position', symbol: 'PEP' },
      { kind: 'detail', symbol: 'KO' },
    ].map((r) => node({ ...position(r.symbol), kind: r.kind as PositionGridRow['kind'] }))

    keepDetailUnderParent(nodes)

    expect(describeNodes(nodes)).toEqual([
      'position:WMT',
      'position:KO',
      'detail:KO',
      'position:PEP',
      'detail:PEP',
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { compileFilter, type FilterKind } from '../columnFilter'

/** The values from `values` that `expression` keeps. */
function keep<T>(expression: string, kind: FilterKind, values: T[]): T[] {
  const filter = compileFilter(expression, kind)
  if (!filter) return values
  if (!filter.ok) throw new Error(filter.error)
  return values.filter((v) => filter.test(v))
}

function errorOf(expression: string, kind: FilterKind) {
  const filter = compileFilter(expression, kind)
  return filter && !filter.ok ? filter.error : null
}

describe('compileFilter: numbers', () => {
  const values = [-200, -5, 0, 5, 6, 10, 15, 20, 1000]

  it.each([
    ['5', [5]],
    ['=5', [5]],
    ['>5', [6, 10, 15, 20, 1000]],
    ['>=5', [5, 6, 10, 15, 20, 1000]],
    ['<0', [-200, -5]],
    ['<=-5', [-200, -5]],
    ['!5', [-200, -5, 0, 6, 10, 15, 20, 1000]],
    ['!=5', [-200, -5, 0, 6, 10, 15, 20, 1000]],
    ['5|6', [5, 6]],
    ['>5&<20', [6, 10, 15]],
    ['>5&<20|-200', [-200, 6, 10, 15]],
    ['10..20', [10, 15, 20]],
    ['20..10', [10, 15, 20]],
    ['!10..20', [-200, -5, 0, 5, 6, 1000]],
    ['-5..5', [-5, 0, 5]],
    ['1,000', [1000]],
    [' > 5 & < 20 ', [6, 10, 15]],
  ])('%s', (expression, expected) => {
    expect(keep(expression, 'number', values)).toEqual(expected)
  })

  it('matches decimals at the precision typed', () => {
    expect(keep('92.71', 'number', [92.71, 92.715, 92.7])).toEqual([92.71])
  })

  it('never matches a missing value', () => {
    expect(keep('!5', 'number', [null, 4])).toEqual([4])
  })

  it.each([
    ['>', '">" needs a value after it'],
    ['abc', '"abc" is not a number'],
    ['5|', 'Something is missing either side of | or &'],
    ['>1..2', 'A range takes no operator other than !'],
    ['1..', 'A range is written low..high'],
  ])('reports %s as invalid', (expression, error) => {
    expect(errorOf(expression, 'number')).toBe(error)
  })

  it('treats an empty expression as no filter', () => {
    expect(compileFilter('   ', 'number')).toBeNull()
  })
})

describe('compileFilter: text', () => {
  const values = ['KO', 'PEP', 'T', 'TMUS', 'TGT']

  it.each([
    ['t', ['T', 'TMUS', 'TGT']],
    ['=t', ['T']],
    ['!t', ['KO', 'PEP']],
    ['!=t', ['KO', 'PEP', 'TMUS', 'TGT']],
    ['ko|pep', ['KO', 'PEP']],
    ['t&!=t', ['TMUS', 'TGT']],
    ['KO', ['KO']],
  ])('%s', (expression, expected) => {
    expect(keep(expression, 'text', values)).toEqual(expected)
  })

  it('rejects comparisons on text', () => {
    expect(errorOf('>a', 'text')).toBe('Text filters take contains, = or !')
  })
})

describe('compileFilter: dates', () => {
  const values = ['2025-12-31', '2026-01-30', '2026-03-31', '2026-09-30', '2026-10-23']

  it.each([
    ['2026', ['2026-01-30', '2026-03-31', '2026-09-30', '2026-10-23']],
    ['2026-09', ['2026-09-30']],
    ['2026-09-30', ['2026-09-30']],
    ['>2026-09', ['2026-10-23']],
    ['>=2026-09-01', ['2026-09-30', '2026-10-23']],
    ['<2026', ['2025-12-31']],
    ['2026-01..2026-03', ['2026-01-30', '2026-03-31']],
    ['2025|2026-10', ['2025-12-31', '2026-10-23']],
    ['!2026', ['2025-12-31']],
  ])('%s', (expression, expected) => {
    expect(keep(expression, 'date', values)).toEqual(expected)
  })

  it('rejects something that is not a date', () => {
    expect(errorOf('sept', 'date')).toBe('"sept" is not a date (YYYY, YYYY-MM or YYYY-MM-DD)')
  })
})

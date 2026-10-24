/**
 * Filter expressions typed under a column header.
 *
 *   |   either side matches (OR)          ko|pep        >100|<-100
 *   &   both sides match (AND), binds     >5&<10        !ko&!pep
 *       tighter than |                    >5&<10|=0  means  (>5 and <10) or =0
 *
 * Numbers: 5 (equals), >5 >=5 <5 <=5, =5, !5 or !=5 (not), 10..20 (inclusive range), !10..20.
 *          Commas are ignored, so 1,000 works; negatives work (<-100).
 * Text:    ko (contains, any case), =ko (exactly), !ko (does not contain), !=ko (is not).
 * Dates:   YYYY, YYYY-MM or YYYY-MM-DD. 2026-09 (that month), >=2026-09-01, 2026-01..2026-03.
 *          A shorter date compares at its own precision: >2026-09 means October onwards.
 *
 * An empty or null cell matches only an empty filter.
 */
export type FilterKind = 'text' | 'number' | 'date'

export type CompiledFilter =
  { ok: true; test: (value: unknown) => boolean } | { ok: false; error: string }

type Predicate = (value: unknown) => boolean

/** Short hint shown in an empty filter input. */
export const FILTER_PLACEHOLDER: Record<FilterKind, string> = {
  number: '>5',
  text: 'ko|pep',
  date: '2026-09',
}

/** Full syntax, shown as the filter input's tooltip. */
export const FILTER_HELP: Record<FilterKind, string> = {
  number: 'Numbers: 5, >5, >=5, <5, <=5, !5 (not), 10..20 (range). | for or, & for and: >5&<10|0',
  text: 'Text: ko (contains), =ko (exactly), !ko (not containing). | for or, & for and: ko|pep',
  date: 'Dates: 2026, 2026-09, 2026-09-30, >=2026-09-01, 2026-01..2026-03. | for or, & for and',
}

const OPERATOR = /^(>=|<=|!=|>|<|=|!)?\s*(.*)$/
const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/

/** null when the expression is empty (no filtering); otherwise a test or an error to show. */
export function compileFilter(expression: string, kind: FilterKind): CompiledFilter | null {
  if (expression.trim() === '') return null
  try {
    const alternatives = expression.split('|').map((alternative) => {
      const conditions = alternative.split('&').map((c) => compileCondition(c.trim(), kind))
      return (value: unknown) => conditions.every((condition) => condition(value))
    })
    return {
      ok: true,
      test: (value) =>
        value !== null && value !== undefined && value !== '' && alternatives.some((a) => a(value)),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

function compileCondition(text: string, kind: FilterKind): Predicate {
  if (text === '') throw new Error('Something is missing either side of | or &')
  const [, op = '', rawValue = ''] = OPERATOR.exec(text)!
  const value = rawValue.trim()
  if (value === '') throw new Error(`"${op}" needs a value after it`)

  switch (kind) {
    case 'number':
      return numberCondition(op, value)
    case 'date':
      return dateCondition(op, value)
    default:
      return textCondition(op, value)
  }
}

function parseNumber(text: string): number {
  const n = Number(text.replace(/[,\s]/g, ''))
  if (text === '' || !Number.isFinite(n)) throw new Error(`"${text}" is not a number`)
  return n
}

/** Split "a..b" into its ends; null when it is not a range. */
function splitRange(value: string): [string, string] | null {
  const parts = value.split('..')
  if (parts.length === 1) return null
  if (parts.length !== 2 || !parts[0]!.trim() || !parts[1]!.trim()) {
    throw new Error('A range is written low..high')
  }
  return [parts[0]!.trim(), parts[1]!.trim()]
}

function numberCondition(op: string, value: string): Predicate {
  const range = splitRange(value)
  if (range) {
    if (op && op !== '!' && op !== '!=') throw new Error('A range takes no operator other than !')
    const [lo, hi] = range.map(parseNumber) as [number, number]
    const inside = (v: unknown) =>
      typeof v === 'number' && v >= Math.min(lo, hi) && v <= Math.max(lo, hi)
    return op ? (v) => typeof v === 'number' && !inside(v) : inside
  }

  const n = parseNumber(value)
  const num =
    (f: (v: number) => boolean): Predicate =>
    (v) =>
      typeof v === 'number' && f(v)
  switch (op) {
    case '>':
      return num((v) => v > n)
    case '>=':
      return num((v) => v >= n)
    case '<':
      return num((v) => v < n)
    case '<=':
      return num((v) => v <= n)
    case '!':
    case '!=':
      return num((v) => !sameNumber(v, n))
    default:
      return num((v) => sameNumber(v, n))
  }
}

/** Equal to the precision typed: 92.71 matches 92.71 but not 92.715. */
const sameNumber = (a: number, b: number) => Math.abs(a - b) < 1e-9

function textCondition(op: string, value: string): Predicate {
  if (op === '>' || op === '<' || op === '>=' || op === '<=') {
    throw new Error('Text filters take contains, = or !')
  }
  const needle = value.toLowerCase()
  const text = (v: unknown) => String(v).toLowerCase()
  switch (op) {
    case '=':
      return (v) => text(v) === needle
    case '!=':
      return (v) => text(v) !== needle
    case '!':
      return (v) => !text(v).includes(needle)
    default:
      return (v) => text(v).includes(needle)
  }
}

function parseDate(text: string): string {
  if (!DATE.test(text)) throw new Error(`"${text}" is not a date (YYYY, YYYY-MM or YYYY-MM-DD)`)
  return text
}

function dateCondition(op: string, value: string): Predicate {
  // Compare the cell at the precision of what was typed: "2026-09" against "2026-09-30" -> "2026-09".
  const at = (v: unknown, precision: string) => String(v).slice(0, precision.length)

  const range = splitRange(value)
  if (range) {
    if (op && op !== '!' && op !== '!=') throw new Error('A range takes no operator other than !')
    const [lo, hi] = range.map(parseDate) as [string, string]
    const inside = (v: unknown) => at(v, lo) >= lo && at(v, hi) <= hi
    return op ? (v) => !inside(v) : inside
  }

  const d = parseDate(value)
  switch (op) {
    case '>':
      return (v) => at(v, d) > d
    case '>=':
      return (v) => at(v, d) >= d
    case '<':
      return (v) => at(v, d) < d
    case '<=':
      return (v) => at(v, d) <= d
    case '!':
    case '!=':
      return (v) => at(v, d) !== d
    default:
      return (v) => at(v, d) === d
  }
}

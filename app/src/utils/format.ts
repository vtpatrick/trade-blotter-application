const quantityFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const priceFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})
const amountFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})
const isoDateFormat = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const formatQuantity = (value: number) => quantityFormat.format(value)
export const formatPrice = (value: number) => priceFormat.format(value)
export const formatAmount = (value: number) => amountFormat.format(value)

/** A trade's date and time in the viewer's zone, always with the date: 2026-10-24 10:17:11. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  // YYYY-MM-DD, the same form the Time column's filter takes.
  return `${isoDateFormat.format(date)} ${timeFormat.format(date)}`
}

/** Amount with an explicit sign, for P&L: +1,234.50 / −1,234.50. */
export function formatSignedAmount(value: number): string {
  const text = amountFormat.format(Math.abs(value))
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text
}

/** Percent with an explicit sign, to 2 decimals: +1.25% / −0.40%. */
export function formatSignedPercent(value: number): string {
  const text = `${Math.abs(value).toFixed(2)}%`
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text
}

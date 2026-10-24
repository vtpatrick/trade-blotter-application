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
const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

export const formatQuantity = (value: number) => quantityFormat.format(value)
export const formatPrice = (value: number) => priceFormat.format(value)
export const formatAmount = (value: number) => amountFormat.format(value)

/** Time only for today's trades; date and time otherwise. */
export function formatTimestamp(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const time = timeFormat.format(date)
  return date.toDateString() === now.toDateString() ? time : `${dateFormat.format(date)} ${time}`
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

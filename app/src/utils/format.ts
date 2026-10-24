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

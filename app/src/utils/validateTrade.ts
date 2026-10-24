import type { NewTrade, TradeSide } from '@/api/trades'

/** Raw form input: numbers stay strings until validated so "" and "abc" can be reported. */
export interface TradeForm {
  symbol: string
  side: TradeSide | ''
  quantity: string
  price: string
}

export type TradeFormErrors = Partial<Record<keyof TradeForm, string>>

export type TradeValidation = { ok: true; trade: NewTrade } | { ok: false; errors: TradeFormErrors }

// Same rules as CreateTradeRequest on the API.
export const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.-]{0,11}$/
const MAX_QUANTITY = 2_147_483_647
const MAX_PRICE = 1_000_000_000

export function validateTrade(form: TradeForm): TradeValidation {
  const errors: TradeFormErrors = {}

  const symbol = form.symbol.trim().toUpperCase()
  if (!symbol) {
    errors.symbol = 'Enter a symbol.'
  } else if (!SYMBOL_PATTERN.test(symbol)) {
    errors.symbol = 'Letters, digits, "." or "-", starting with a letter (max 12).'
  }

  if (!form.side) {
    errors.side = 'Choose Buy or Sell.'
  }

  const quantityText = form.quantity.trim()
  const quantity = Number(quantityText)
  if (!quantityText) {
    errors.quantity = 'Enter a quantity.'
  } else if (!Number.isInteger(quantity) || quantity <= 0) {
    errors.quantity = 'Quantity must be a positive whole number.'
  } else if (quantity > MAX_QUANTITY) {
    errors.quantity = 'Quantity is too large.'
  }

  const priceText = form.price.trim()
  const price = Number(priceText)
  if (!priceText) {
    errors.price = 'Enter a price.'
  } else if (!Number.isFinite(price) || price <= 0) {
    errors.price = 'Price must be greater than 0.'
  } else if (price > MAX_PRICE) {
    errors.price = 'Price is too large.'
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, trade: { symbol, side: form.side as TradeSide, quantity, price } }
}

import { describe, expect, it } from 'vitest'
import { validateTrade, type TradeForm } from '../validateTrade'

const valid: TradeForm = { symbol: 'aapl ', side: 'Buy', quantity: '100', price: '150.25' }

describe('validateTrade', () => {
  it('normalizes a valid ticket', () => {
    expect(validateTrade(valid)).toEqual({
      ok: true,
      trade: { symbol: 'AAPL', side: 'Buy', quantity: 100, price: 150.25 },
    })
  })

  it('reports every empty field', () => {
    const result = validateTrade({ symbol: ' ', side: '', quantity: '', price: '' })

    expect(result).toEqual({
      ok: false,
      errors: {
        symbol: 'Enter a symbol.',
        side: 'Choose Buy or Sell.',
        quantity: 'Enter a quantity.',
        price: 'Enter a price.',
      },
    })
  })

  it.each([
    ['0', 'positive'],
    ['-5', 'positive'],
    ['1.5', 'whole'],
    ['abc', 'whole'],
  ])('rejects quantity %s', (quantity, message) => {
    expect(validateTrade({ ...valid, quantity })).toEqual({
      ok: false,
      errors: { quantity: expect.stringContaining(message) },
    })
  })

  it.each(['0', '-1', 'abc'])('rejects price %s', (price) => {
    expect(validateTrade({ ...valid, price })).toEqual({
      ok: false,
      errors: { price: 'Price must be greater than 0.' },
    })
  })

  it.each(['1AAPL', 'AA PL', 'TOOLONGSYMBOL'])('rejects symbol %s', (symbol) => {
    expect(validateTrade({ ...valid, symbol }).ok).toBe(false)
  })

  it('accepts share-class symbols', () => {
    expect(validateTrade({ ...valid, symbol: 'brk.b' }).ok).toBe(true)
  })
})

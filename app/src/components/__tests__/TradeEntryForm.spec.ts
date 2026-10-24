import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { LiveQuote } from '@/api/bloomberg'
import { TradeRejectedError, type Trade } from '@/api/trades'
import { useBlotterStore } from '@/stores/blotter'
import TradeEntryForm from '../TradeEntryForm.vue'

// The ticket looks up a live Bloomberg price as the symbol is typed; never hit DeskLink in tests.
const bloomberg = vi.hoisted(() => ({
  fetchLiveQuote: vi.fn<(symbol: string, signal?: AbortSignal) => Promise<LiveQuote | null>>(),
  fetchBloombergAvailable: vi.fn<() => Promise<boolean>>(),
}))
vi.mock('@/api/bloomberg', () => bloomberg)

const booked: Trade = {
  id: 1,
  symbol: 'AAPL',
  side: 'Sell',
  quantity: 100,
  price: 150.25,
  notional: 15025,
  timestamp: '2026-10-24T14:00:00Z',
}

describe('TradeEntryForm', () => {
  let submitTrade: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setActivePinia(createPinia())
    submitTrade = vi.spyOn(useBlotterStore(), 'submitTrade').mockResolvedValue(booked)
    bloomberg.fetchLiveQuote.mockResolvedValue(null)
    bloomberg.fetchBloombergAvailable.mockResolvedValue(true)
  })

  async function fill(wrapper: ReturnType<typeof mount>, symbol: string, qty: string, px: string) {
    await wrapper.find('#trade-symbol').setValue(symbol)
    await wrapper.find('#trade-quantity').setValue(qty)
    await wrapper.find('#trade-price').setValue(px)
  }

  it('shows field errors only after a submit attempt, and does not submit', async () => {
    const wrapper = mount(TradeEntryForm)
    expect(wrapper.findAll('.field-error')).toHaveLength(0)

    await wrapper.find('form').trigger('submit')

    expect(wrapper.findAll('.field-error').map((e) => e.text())).toEqual([
      'Enter a symbol.',
      'Enter a quantity.',
      'Enter a price.',
    ])
    expect(submitTrade).not.toHaveBeenCalled()
  })

  it('submits a normalized trade, then clears the ticket but keeps the side', async () => {
    const wrapper = mount(TradeEntryForm)
    await wrapper.find('input[value="Sell"]').setValue(true)
    await fill(wrapper, ' aapl', '100', '150.25')

    expect(wrapper.find('button[type="submit"]').text()).toMatch(/^Sell 100 AAPL @ 150\.25$/)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(submitTrade).toHaveBeenCalledWith({
      symbol: 'AAPL',
      side: 'Sell',
      quantity: 100,
      price: 150.25,
    })
    expect((wrapper.find('#trade-symbol').element as HTMLInputElement).value).toBe('')
    expect((wrapper.find('input[value="Sell"]').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.find('.booked').text()).toContain('Booked sell 100 AAPL')
  })

  it('shows server-side field errors next to the field', async () => {
    submitTrade.mockRejectedValue(
      new TradeRejectedError('Validation failed', { price: 'Price must be greater than 0.' }),
    )
    const wrapper = mount(TradeEntryForm)
    await fill(wrapper, 'AAPL', '10', '5')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('#trade-price-error').text()).toBe('Price must be greater than 0.')
  })

  it('shows the live price for the typed symbol and fills it on "Use"', async () => {
    vi.useFakeTimers()
    try {
      bloomberg.fetchLiveQuote.mockResolvedValue({
        symbol: 'KO',
        name: 'COCA-COLA CO/THE',
        last: 92.71,
        changePercent: 0.42,
        asOf: '2026-10-24T13:36:39Z',
      })
      const wrapper = mount(TradeEntryForm)

      await wrapper.find('#trade-symbol').setValue('ko')
      await vi.advanceTimersByTimeAsync(400)

      const live = wrapper.find('.live-quote')
      expect(live.text()).toContain('COCA-COLA CO/THE')
      expect(live.text()).toContain('92.71')
      expect(live.text()).toContain('+0.42%')

      await live.find('button.use-price').trigger('click')
      expect((wrapper.find('#trade-price').element as HTMLInputElement).value).toBe('92.71')
    } finally {
      vi.useRealTimers()
    }
  })

  it('says up front when live prices are unavailable on this desk', async () => {
    bloomberg.fetchBloombergAvailable.mockResolvedValue(false)
    const wrapper = mount(TradeEntryForm)
    await flushPromises()

    expect(wrapper.find('.price-source').text()).toBe('Live prices unavailable')
    expect(wrapper.find('.price-source').classes()).toContain('unavailable')
  })
})

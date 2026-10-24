import { describe, expect, it } from 'vitest'
import { formatTimestamp } from '../format'

describe('formatTimestamp', () => {
  it('always shows the date with the time, today included', () => {
    const now = new Date()
    now.setHours(10, 17, 11, 0)

    const text = formatTimestamp(now.toISOString())

    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    expect(text).toBe(`${yyyy}-${mm}-${dd} 10:17:11`)
  })
})

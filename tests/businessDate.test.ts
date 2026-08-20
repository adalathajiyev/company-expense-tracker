import { describe, expect, it } from 'vitest'
import { getBusinessDate, getBusinessMonth, isFutureBusinessDate } from '../src/lib/businessDate'

describe('Baku business dates', () => {
  it('rolls over at Baku midnight instead of UTC midnight', () => {
    const instant = new Date('2026-08-19T20:30:00.000Z')
    expect(getBusinessDate(instant)).toBe('2026-08-20')
    expect(getBusinessMonth(instant)).toBe('2026-08')
  })

  it('uses the same business date for future-date validation', () => {
    const instant = new Date('2026-08-19T20:30:00.000Z')
    expect(isFutureBusinessDate('2026-08-20', instant)).toBe(false)
    expect(isFutureBusinessDate('2026-08-21', instant)).toBe(true)
  })
})

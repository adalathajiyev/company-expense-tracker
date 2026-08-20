import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatMonth, getBusinessDate, getBusinessMonth, isFutureBusinessDate } from '../src/lib/businessDate'

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

  it('formats dates day-first and timestamps in Baku time', () => {
    expect(formatDate('2026-08-03')).toBe('03/08/2026')
    expect(formatDateTime('2026-08-03T21:30:00.000Z')).toBe('04/08/2026, 01:30')
    expect(formatMonth('2026-08-01')).toBe('08/2026')
  })
})

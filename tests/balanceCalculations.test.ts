import { describe, expect, it } from 'vitest'
import { calculateAdjustmentAmounts, calculateNetPosition } from '../src/modules/balance/balanceCalculations'

describe('balance calculations', () => {
  it('keeps an obligation outstanding until a settlement is recorded', () => {
    expect(calculateAdjustmentAmounts(1000, [])).toEqual({
      settledAmount: 0,
      remainingAmount: 1000,
      status: 'outstanding',
    })
  })

  it('calculates partial and complete settlements with money-safe rounding', () => {
    expect(calculateAdjustmentAmounts(1000, [250.1, 349.9])).toEqual({
      settledAmount: 600,
      remainingAmount: 400,
      status: 'partially_paid',
    })
    expect(calculateAdjustmentAmounts(1000, [600, 400])).toEqual({
      settledAmount: 1000,
      remainingAmount: 0,
      status: 'settled',
    })
  })

  it('keeps physical cash separate from the net cash position', () => {
    expect(calculateNetPosition(5000, 1000, 300)).toBe(5700)
  })

  it('keeps net position stable when cash creates an obligation', () => {
    // Lending 1,000 reduces cash from 5,000 to 4,000 and creates a receivable.
    expect(calculateNetPosition(4000, 1000, 0)).toBe(5000)
    // Borrowing 500 increases cash to 5,500 and creates a matching payable.
    expect(calculateNetPosition(5500, 0, 500)).toBe(5000)
  })
})

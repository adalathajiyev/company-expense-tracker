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
})

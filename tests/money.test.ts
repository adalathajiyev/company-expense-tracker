import { describe, expect, it } from 'vitest'
import { roundMoney, sumMoney } from '../src/lib/money'

describe('money helpers', () => {
  it('rounds calculated amounts to two decimal places', () => {
    expect(roundMoney(10.005)).toBe(10.01)
  })

  it('sums in minor units without floating-point drift', () => {
    expect(sumMoney([0.1, 0.2, 10.005])).toBe(10.31)
  })
})

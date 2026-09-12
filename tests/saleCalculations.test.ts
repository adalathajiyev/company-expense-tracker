import { describe, expect, it } from 'vitest'
import { calculateSaleAmount, isSaleTotalBelowAllocated } from '../src/modules/sales/saleCalculations'

describe('calculateSaleAmount', () => {
  it('supports quantities with up to six decimal places', () => {
    expect(calculateSaleAmount('2.345678', '100')).toBe('234.57')
  })

  it('supports unit prices with up to six decimal places', () => {
    expect(calculateSaleAmount('3', '12.345678')).toBe('37.04')
  })

  it('rounds only the final total to currency precision', () => {
    expect(calculateSaleAmount('1', '10.005')).toBe('10.01')
  })

  it('rejects more than six decimal places', () => {
    expect(calculateSaleAmount('1.1234567', '10')).toBeNull()
  })

  it('rejects values whose rounded total is less than one qapik', () => {
    expect(calculateSaleAmount('0.000001', '0.000001')).toBeNull()
  })

  it('allows an edited sale total equal to allocated payments', () => {
    expect(isSaleTotalBelowAllocated('600.00', 600)).toBe(false)
  })

  it('rejects an edited sale total below allocated payments', () => {
    expect(isSaleTotalBelowAllocated('599.99', 600)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { buildAutomaticAllocations, getPaymentAllocationStatus, getRemainingSaleAmount } from '../src/modules/customers/paymentAllocationCalculations'
import type { Sale } from '../src/modules/sales/types'

function sale(overrides: Partial<Sale> & Pick<Sale, 'id' | 'sale_date' | 'amount' | 'paid_amount'>): Sale {
  return {
    customer_id: 'customer-1',
    customer_name: 'Customer',
    product: 'Product',
    description: null,
    category: 'Other',
    quantity: 1,
    unit: 'piece',
    unit_price: overrides.amount,
    payment_method: 'Cash',
    created_by: null,
    created_by_email: 'Unknown',
    created_at: `${overrides.sale_date}T10:00:00Z`,
    status: 'unpaid',
    payment_allocations: [],
    ...overrides,
  }
}

describe('customer payment allocations', () => {
  it('applies existing credit to the oldest open sale first', () => {
    const newer = sale({ id: 'sale-new', sale_date: '2026-09-04', amount: 500, paid_amount: 0 })
    const older = sale({ id: 'sale-old', sale_date: '2026-08-20', amount: 300, paid_amount: 100 })

    expect(buildAutomaticAllocations([newer, older], 350)).toEqual({
      'sale-old': '200.00',
      'sale-new': '150.00',
    })
  })

  it('does not allocate more than a sale has remaining', () => {
    const openSale = sale({ id: 'sale-1', sale_date: '2026-09-01', amount: 1000.25, paid_amount: 600.1 })

    expect(getRemainingSaleAmount(openSale)).toBe(400.15)
    expect(buildAutomaticAllocations([openSale], 500)).toEqual({ 'sale-1': '400.15' })
  })

  it('classifies payment allocation progress for the report', () => {
    expect(getPaymentAllocationStatus({ allocated_amount: 0, unallocated_amount: 500 })).toBe('unallocated')
    expect(getPaymentAllocationStatus({ allocated_amount: 200, unallocated_amount: 300 })).toBe('partially_allocated')
    expect(getPaymentAllocationStatus({ allocated_amount: 500, unallocated_amount: 0 })).toBe('fully_allocated')
  })
})

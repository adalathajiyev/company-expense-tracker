import { roundMoney } from '../../lib/money'
import type { Sale } from '../sales/types'
import type { CustomerPayment } from './types'

export type PaymentAllocationStatus = 'fully_allocated' | 'partially_allocated' | 'unallocated'

export function getRemainingSaleAmount(sale: Sale) {
  return Math.max(roundMoney(Number(sale.amount) - Number(sale.paid_amount)), 0)
}

export function buildAutomaticAllocations(sales: Sale[], amount: number) {
  let available = Math.max(amount, 0)
  const allocations: Record<string, string> = {}
  const ordered = [...sales].sort((a, b) => a.sale_date.localeCompare(b.sale_date) || a.created_at.localeCompare(b.created_at))

  ordered.forEach((sale) => {
    if (available <= 0) return
    const allocation = Math.min(getRemainingSaleAmount(sale), available)
    if (allocation > 0) allocations[sale.id] = allocation.toFixed(2)
    available = roundMoney(available - allocation)
  })

  return allocations
}

export function getPaymentAllocationStatus(payment: Pick<CustomerPayment, 'allocated_amount' | 'unallocated_amount'>): PaymentAllocationStatus {
  if (Number(payment.allocated_amount) <= 0) return 'unallocated'
  if (Number(payment.unallocated_amount) <= 0) return 'fully_allocated'
  return 'partially_allocated'
}

import { roundMoney, sumMoney } from '../../lib/money'
import type { BalanceAdjustmentStatus } from './types'

export function calculateAdjustmentAmounts(amount: number, settlementAmounts: Iterable<number>) {
  const settledAmount = sumMoney(settlementAmounts)
  const remainingAmount = Math.max(0, roundMoney(amount - settledAmount))
  const status: BalanceAdjustmentStatus = remainingAmount === 0
    ? 'settled'
    : settledAmount > 0
      ? 'partially_paid'
      : 'outstanding'

  return { settledAmount, remainingAmount, status }
}

export function calculateNetPosition(physicalCash: number, receivables: number, payables: number) {
  return roundMoney(physicalCash + receivables - payables)
}

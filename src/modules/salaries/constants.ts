import type { SalaryPaymentType } from './types'

export const mealRate = 1.5
export const paymentTypeLabels: Record<SalaryPaymentType, string> = {
  cash_payment: 'Cash payment',
  card_transfer: 'Card transfer',
}

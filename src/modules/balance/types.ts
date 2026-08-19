export interface CashBalance {
  cash_sales: number
  owner_funding: number
  cash_expenses: number
  remaining_debts: number
  cash_salary_payments: number
  payments_to_receive: number
  payments_to_pay: number
  balance: number
}

export type BalanceAdjustmentDirection = 'receivable' | 'payable'

export interface BalanceAdjustment {
  id: string
  name: string
  description: string | null
  amount: number
  direction: BalanceAdjustmentDirection
  created_at: string
}

export interface BalanceAdjustmentInput {
  name: string
  description: string | null
  amount: number
  direction: BalanceAdjustmentDirection
}

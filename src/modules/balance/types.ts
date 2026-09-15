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
export type BalanceAdjustmentPaymentMethod = 'Cash' | 'Bank transfer'
export type BalanceAdjustmentStatus = 'outstanding' | 'partially_paid' | 'settled'

export interface BalanceAdjustmentSettlement {
  id: string
  balance_adjustment_id: string
  payment_date: string
  payment_method: BalanceAdjustmentPaymentMethod
  cash_account_id: string | null
  amount: number
  note: string | null
  created_by: string | null
  created_by_email: string
  created_at: string
}

export interface BalanceAdjustment {
  id: string
  name: string
  description: string | null
  amount: number
  direction: BalanceAdjustmentDirection
  created_at: string
  settlements: BalanceAdjustmentSettlement[]
  settled_amount: number
  remaining_amount: number
  status: BalanceAdjustmentStatus
}

export interface BalanceAdjustmentInput {
  name: string
  description: string | null
  amount: number
  direction: BalanceAdjustmentDirection
}

export interface BalanceAdjustmentSettlementInput {
  balance_adjustment_id: string
  payment_date: string
  payment_method: BalanceAdjustmentPaymentMethod
  cash_account_id: string | null
  amount: number
  note: string | null
}

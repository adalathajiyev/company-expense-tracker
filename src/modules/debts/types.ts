export type DebtStatus = 'paid' | 'partially_paid' | 'unpaid'

export interface Debt {
  id: string
  debt_date: string
  worker_name: string
  description: string | null
  amount: number
  created_at: string
  paid_amount: number
  status: DebtStatus
  payments: DebtPayment[]
}

export type DebtInput = Pick<Debt, 'debt_date' | 'worker_name' | 'description' | 'amount'>

export interface DebtPayment {
  id: string
  debt_id: string
  payment_date: string
  amount: number
  note: string | null
  created_at: string
}

export type DebtPaymentInput = Omit<DebtPayment, 'id' | 'created_at'>

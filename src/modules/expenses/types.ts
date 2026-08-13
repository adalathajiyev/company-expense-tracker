export type ExpenseStatus = 'paid' | 'pending'

export interface Expense {
  id: string
  expense_date: string
  merchant: string
  description: string | null
  category: string
  payment_method: string
  amount: number
  status: ExpenseStatus
  receipt_url: string | null
  created_at: string
}

export type ExpenseInput = Omit<Expense, 'id' | 'created_at' | 'receipt_url'>

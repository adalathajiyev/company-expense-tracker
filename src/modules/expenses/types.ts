export type ExpenseStatus = 'paid' | 'pending'

export interface Expense {
  id: string
  expense_date: string
  merchant: string
  description: string | null
  category: string
  payment_method: string
  quantity: number
  unit: string
  unit_price: number
  amount: number
  status: ExpenseStatus
  receipt_url: string | null
  salary_source_id: string | null
  created_at: string
}

export type ExpenseInput = Omit<Expense, 'id' | 'created_at' | 'receipt_url' | 'salary_source_id'>

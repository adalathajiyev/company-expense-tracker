import type { ExpenseInput } from './types'

export const categories = ['Office', 'Software', 'Travel', 'Meals', 'Marketing', 'Utilities', 'Payroll', 'Other']
export const paymentMethods = ['Cash', 'Bank transfer']

export const emptyExpense: ExpenseInput = {
  expense_date: new Date().toISOString().slice(0, 10),
  merchant: '',
  description: '',
  category: 'Office',
  payment_method: 'Bank transfer',
  amount: 0,
  status: 'paid',
}

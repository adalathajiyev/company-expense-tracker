import type { ExpenseInput } from './types'
import { getBusinessDate } from '../../lib/businessDate'

export const categories = ['Office', 'Software', 'Travel', 'Meals', 'Marketing', 'Utilities', 'Payroll', 'Other']
export const paymentMethods = ['Cash', 'Bank transfer']
export const units = ['Piece', 'Kilogram', 'Liter', 'Meter', 'Box', 'Service']

export function createEmptyExpense(): ExpenseInput {
  return {
    expense_date: getBusinessDate(),
    merchant: '',
    description: '',
    category: 'Office',
    payment_method: 'Bank transfer',
    quantity: 1,
    unit: 'Piece',
    unit_price: 0,
    amount: 0,
    status: 'paid',
  }
}

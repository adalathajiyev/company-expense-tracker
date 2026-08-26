import type { ExpenseInput } from './types'
import { getBusinessDate } from '../../lib/businessDate'
export { units } from '../../lib/units'

export const categories = [
  'Other Projects',
  'Owner Costs',
  'Truck Costs',
  'Kitchen',
  'Office',
  'Salaries',
  'Government',
  'Maintenance',
  'Factory',
  'Raw Materials',
] as const
export const paymentMethods = ['Cash', 'Bank transfer']
export function createEmptyExpense(): ExpenseInput {
  return {
    expense_date: getBusinessDate(),
    merchant: '',
    description: '',
    category: 'Office',
    payment_method: 'Cash',
    quantity: 1,
    unit: 'Piece',
    unit_price: 0,
    amount: 0,
    status: 'paid',
    cash_account_id: null,
    project_id: null,
  }
}

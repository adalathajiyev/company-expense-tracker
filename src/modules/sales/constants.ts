import type { SaleInput } from './types'
import { getBusinessDate } from '../../lib/businessDate'

export const units = ['Piece', 'Kilogram', 'Liter', 'Meter', 'Box', 'Service']
export const paymentMethods = ['Cash', 'Bank transfer'] as const
export function createEmptySale(): SaleInput {
  return { customer_id: '', sale_date: getBusinessDate(), product: '', quantity: 1, unit: 'Piece', unit_price: 0, amount: 0, payment_method: 'Cash' }
}

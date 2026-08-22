import type { SaleCategory, SaleInput } from './types'
import { getBusinessDate } from '../../lib/businessDate'
export { units } from '../../lib/units'

export const paymentMethods = ['Cash', 'Bank transfer'] as const
export const saleCategories = ['Pallet', 'Pellet', 'Furniture', 'Raw materials', 'Metal Pipes', 'Sawdust', 'Transportation', 'Other'] as const satisfies readonly SaleCategory[]
export function createEmptySale(): SaleInput {
  return { customer_id: '', sale_date: getBusinessDate(), product: '', description: null, category: 'Other', quantity: '1', unit: 'Piece', unit_price: '', payment_method: 'Cash' }
}

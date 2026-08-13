import type { SaleInput } from './types'

export const units = ['Piece', 'Kilogram', 'Liter', 'Meter', 'Box', 'Service']
export const paymentMethods = ['Cash', 'Bank transfer'] as const
export const emptySale: SaleInput = { sale_date: new Date().toISOString().slice(0, 10), product: '', quantity: 1, unit: 'Piece', unit_price: 0, amount: 0, paid_amount: 0, payment_method: 'Cash', status: 'unpaid' }

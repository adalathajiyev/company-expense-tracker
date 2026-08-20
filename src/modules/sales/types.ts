import type { CustomerPayment, PaymentAllocation } from '../customers/types'

export type SaleStatus = 'paid' | 'partially_paid' | 'unpaid'
export type SalePaymentMethod = 'Cash' | 'Bank transfer'

export interface SalePaymentAllocation extends PaymentAllocation {
  payment: CustomerPayment
}

export interface Sale {
  id: string
  customer_id: string
  customer_name: string
  sale_date: string
  product: string
  quantity: number
  unit: string
  unit_price: number
  amount: number
  payment_method: SalePaymentMethod
  created_by: string | null
  created_by_email: string
  created_at: string
  paid_amount: number
  status: SaleStatus
  payment_allocations: SalePaymentAllocation[]
}

export type SaleInput = Pick<Sale, 'customer_id' | 'sale_date' | 'product' | 'quantity' | 'unit' | 'unit_price' | 'amount' | 'payment_method'>

import type { CustomerPayment, PaymentAllocation } from '../customers/types'

export type SaleStatus = 'paid' | 'partially_paid' | 'unpaid'
export type SalePaymentMethod = 'Cash' | 'Bank transfer'
export type SaleCategory = 'Pallet' | 'Pellet' | 'Furniture' | 'Raw materials' | 'Metal Pipes' | 'Sawdust' | 'Transportation' | 'Other'

export interface SalePaymentAllocation extends PaymentAllocation {
  payment: CustomerPayment
}

export interface Sale {
  id: string
  customer_id: string
  customer_name: string
  sale_date: string
  product: string
  description: string | null
  category: SaleCategory
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

export type SaleInput = Pick<Sale, 'customer_id' | 'sale_date' | 'product' | 'description' | 'category' | 'unit' | 'payment_method'> & {
  quantity: string
  unit_price: string
}

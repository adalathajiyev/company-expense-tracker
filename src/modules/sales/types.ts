export type SaleStatus = 'paid' | 'partially_paid' | 'unpaid'
export type SalePaymentMethod = 'Cash' | 'Bank transfer'

export interface Sale {
  id: string
  sale_date: string
  product: string
  quantity: number
  unit: string
  unit_price: number
  amount: number
  paid_amount: number
  payment_method: SalePaymentMethod
  status: SaleStatus
  created_at: string
}

export type SaleInput = Omit<Sale, 'id' | 'created_at'>

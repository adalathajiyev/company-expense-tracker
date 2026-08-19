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
  created_at: string
  paid_amount: number
  status: SaleStatus
  payments: SalePayment[]
}

export type SaleInput = Pick<Sale, 'sale_date' | 'product' | 'quantity' | 'unit' | 'unit_price' | 'amount'>

export interface SalePayment {
  id: string
  sale_id: string
  payment_date: string
  amount: number
  payment_method: SalePaymentMethod
  note: string | null
  created_at: string
}

export type SalePaymentInput = Omit<SalePayment, 'id' | 'created_at'>

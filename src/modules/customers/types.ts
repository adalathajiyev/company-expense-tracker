export type CustomerPaymentMethod = 'Cash' | 'Bank transfer'

export interface Customer {
  id: string
  name: string
  phone: string
  details: string | null
  created_at: string
}

export interface CustomerInput {
  name: string
  phone: string
  details: string | null
}

export interface PaymentAllocation {
  id: string
  payment_id: string
  sale_id: string
  amount: number
  created_at: string
}

export interface CustomerPayment {
  id: string
  customer_id: string
  payment_date: string
  amount: number
  payment_method: CustomerPaymentMethod
  reference: string | null
  note: string | null
  created_by: string | null
  created_by_email: string
  created_at: string
  allocations: PaymentAllocation[]
  allocated_amount: number
  unallocated_amount: number
}

export interface CustomerPaymentAllocationInput {
  sale_id: string
  amount: number
}

export interface CustomerPaymentInput {
  customer_id: string
  payment_date: string
  amount: number
  payment_method: CustomerPaymentMethod
  reference: string | null
  note: string | null
  allocations: CustomerPaymentAllocationInput[]
}

export interface CustomerSummary {
  customer: Customer
  sales_count: number
  total_sales: number
  total_received: number
  outstanding: number
  credit: number
  unallocated: number
}

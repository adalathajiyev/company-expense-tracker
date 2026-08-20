import { supabase } from '../../lib/supabase'
import type {
  Customer,
  CustomerInput,
  CustomerPayment,
  CustomerPaymentInput,
  PaymentAllocation,
} from './types'
import { fetchAllPages } from '../../lib/pagination'
import { sumMoney } from '../../lib/money'

type CustomerPaymentRow = Omit<CustomerPayment, 'allocations' | 'allocated_amount' | 'unallocated_amount'>

function toCustomerPayment(row: CustomerPaymentRow, allocations: PaymentAllocation[]): CustomerPayment {
  const allocatedAmount = sumMoney(allocations.map((allocation) => Number(allocation.amount)))
  return {
    ...row,
    allocations,
    allocated_amount: allocatedAmount,
    unallocated_amount: Math.max(Number(row.amount) - allocatedAmount, 0),
  }
}

export async function getCustomers() {
  return fetchAllPages<Customer>(async (from, to) => {
    const { data, error } = await supabase.from('customers').select('*').order('name').order('id').range(from, to)
    return { data: data as Customer[] | null, error }
  })
}

export async function getCustomerPayments() {
  const [rows, allocationRows] = await Promise.all([
    fetchAllPages<CustomerPaymentRow>(async (from, to) => {
      const { data, error } = await supabase
        .from('customer_payments')
        .select('*')
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to)
      return { data: data as CustomerPaymentRow[] | null, error }
    }),
    fetchAllPages<PaymentAllocation>(async (from, to) => {
      const { data, error } = await supabase
        .from('payment_allocations')
        .select('*')
        .order('created_at')
        .order('id')
        .range(from, to)
      return { data: data as PaymentAllocation[] | null, error }
    }),
  ])
  const allocationsByPayment = new Map<string, PaymentAllocation[]>()
  allocationRows.forEach((allocation) => {
    const paymentAllocations = allocationsByPayment.get(allocation.payment_id) ?? []
    paymentAllocations.push(allocation)
    allocationsByPayment.set(allocation.payment_id, paymentAllocations)
  })
  return rows.map((row) => toCustomerPayment(row, allocationsByPayment.get(row.id) ?? []))
}

export async function createCustomer(input: CustomerInput) {
  const name = input.name.trim()
  const phone = input.phone.trim()

  if (!name || !phone) throw new Error('Customer name and phone number are required.')

  const { data, error } = await supabase
    .from('customers')
    .insert({
      name,
      phone,
      details: input.details?.trim() || null,
    })
    .select()
    .single()

  if (error) throw error
  return data as Customer
}

export async function createCustomerPayment(input: CustomerPaymentInput) {
  const { data, error } = await supabase.rpc('record_customer_payment', {
    p_customer_id: input.customer_id,
    p_payment_date: input.payment_date,
    p_amount: input.amount,
    p_payment_method: input.payment_method,
    p_reference: input.reference,
    p_note: input.note,
    p_allocations: input.allocations,
  })

  if (error) throw error
  return data as string
}

export async function removeCustomerPayment(id: string) {
  const { data, error } = await supabase
    .from('customer_payments')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Only the creator or an Admin can delete this payment.')
}

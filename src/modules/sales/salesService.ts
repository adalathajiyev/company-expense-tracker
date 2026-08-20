import { supabase } from '../../lib/supabase'
import { getCustomerPayments, getCustomers } from '../customers/customerService'
import type { Customer, CustomerPayment } from '../customers/types'
import type {
  Sale,
  SaleInput,
  SaleStatus,
} from './types'
import { fetchAllPages } from '../../lib/pagination'
import { sumMoney } from '../../lib/money'

interface SaleRow extends Omit<Sale, 'customer_name' | 'paid_amount' | 'status' | 'payment_allocations'> {
  customers: Pick<Customer, 'id' | 'name'> | null
}

export interface SalesWorkspace {
  customers: Customer[]
  payments: CustomerPayment[]
  sales: Sale[]
}

export async function getSalesWorkspace(): Promise<SalesWorkspace> {
  const [customersResult, salesResult, paymentsResult] = await Promise.all([
    getCustomers(),
    fetchAllPages<SaleRow>(async (from, to) => {
      const { data, error } = await supabase.from('sales').select('*, customers(id, name)').order('sale_date', { ascending: false }).order('created_at', { ascending: false }).order('id').range(from, to)
      return { data: data as SaleRow[] | null, error }
    }),
    getCustomerPayments(),
  ])

  const customers = customersResult
  const payments = paymentsResult
  const paymentById = new Map(payments.map((payment) => [payment.id, payment]))
  const allocationsBySale = new Map<string, Sale['payment_allocations']>()

  payments.forEach((payment) => {
    payment.allocations.forEach((allocation) => {
      const current = allocationsBySale.get(allocation.sale_id) ?? []
      current.push({ ...allocation, payment: paymentById.get(payment.id) ?? payment })
      allocationsBySale.set(allocation.sale_id, current)
    })
  })

  const sales = salesResult.map((row) => {
    const allocations = allocationsBySale.get(row.id) ?? []
    const paidAmount = sumMoney(allocations.map((allocation) => Number(allocation.amount)))
    const status: SaleStatus = paidAmount === 0 ? 'unpaid' : paidAmount >= Number(row.amount) ? 'paid' : 'partially_paid'
    const { customers: customer, ...sale } = row

    return {
      ...sale,
      customer_name: customer?.name ?? 'Unknown customer',
      payment_allocations: allocations.sort((a, b) => b.payment.payment_date.localeCompare(a.payment.payment_date)),
      paid_amount: paidAmount,
      status,
    }
  })

  return { customers, payments, sales }
}

export async function createSale(input: SaleInput) {
  const { error } = await supabase.from('sales').insert(input)
  if (error) throw error
}

export async function updateSaleCustomer(saleId: string, customerId: string) {
  const { error } = await supabase.rpc('reassign_sale_customer', {
    p_sale_id: saleId,
    p_customer_id: customerId,
  })

  if (error) throw error
}

export async function removeSale(id: string) {
  const { data, error } = await supabase.from('sales').delete().eq('id', id).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Only the creator or an Admin can delete this sale.')
}

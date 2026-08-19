import { supabase } from '../../lib/supabase'
import type { Sale, SaleInput, SalePayment, SalePaymentInput, SaleStatus } from './types'

interface SaleRow extends Omit<Sale, 'payments' | 'paid_amount' | 'status'> {
  sale_payments: SalePayment[] | null
}

function toSale(row: SaleRow): Sale {
  const payments = row.sale_payments ?? []
  const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  const status: SaleStatus = paidAmount === 0 ? 'unpaid' : paidAmount >= Number(row.amount) ? 'paid' : 'partially_paid'
  return { ...row, payments, paid_amount: paidAmount, status }
}

export async function getSales() {
  const { data, error } = await supabase.from('sales').select('*, sale_payments(*)').order('sale_date', { ascending: false }).order('payment_date', { referencedTable: 'sale_payments', ascending: false })
  if (error) throw error
  return (data as SaleRow[]).map(toSale)
}

export async function createSale(input: SaleInput) {
  const { data, error } = await supabase.from('sales').insert(input).select().single()
  if (error) throw error
  return toSale({ ...(data as Omit<SaleRow, 'sale_payments'>), sale_payments: [] })
}

export async function createSalePayment(input: SalePaymentInput) {
  const { data, error } = await supabase.from('sale_payments').insert(input).select().single()
  if (error) throw error
  return data as SalePayment
}

export async function removeSalePayment(id: string) {
  const { error } = await supabase.from('sale_payments').delete().eq('id', id)
  if (error) throw error
}

export async function removeSale(id: string) {
  const { error } = await supabase.from('sales').delete().eq('id', id)
  if (error) throw error
}

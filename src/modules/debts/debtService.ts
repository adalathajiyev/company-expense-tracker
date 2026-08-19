import { supabase } from '../../lib/supabase'
import type { Debt, DebtInput, DebtPayment, DebtPaymentInput, DebtStatus } from './types'

interface DebtRow extends Omit<Debt, 'payments' | 'paid_amount' | 'status'> {
  worker_debt_payments: DebtPayment[] | null
}

function toDebt(row: DebtRow): Debt {
  const payments = row.worker_debt_payments ?? []
  const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  const status: DebtStatus = paidAmount === 0 ? 'unpaid' : paidAmount >= Number(row.amount) ? 'paid' : 'partially_paid'
  return { ...row, payments, paid_amount: paidAmount, status }
}

export async function getDebts() {
  const { data, error } = await supabase.from('worker_debts').select('*, worker_debt_payments(*)').order('debt_date', { ascending: false }).order('payment_date', { referencedTable: 'worker_debt_payments', ascending: false })
  if (error) throw error
  return (data as DebtRow[]).map(toDebt)
}

export async function createDebt(input: DebtInput) {
  const { data, error } = await supabase.from('worker_debts').insert(input).select().single()
  if (error) throw error
  return toDebt({ ...(data as Omit<DebtRow, 'worker_debt_payments'>), worker_debt_payments: [] })
}

export async function createDebtPayment(input: DebtPaymentInput) {
  const { data, error } = await supabase.from('worker_debt_payments').insert(input).select().single()
  if (error) throw error
  return data as DebtPayment
}

export async function removeDebtPayment(id: string) {
  const { error } = await supabase.from('worker_debt_payments').delete().eq('id', id)
  if (error) throw error
}

export async function removeDebt(id: string) {
  const { error } = await supabase.from('worker_debts').delete().eq('id', id)
  if (error) throw error
}

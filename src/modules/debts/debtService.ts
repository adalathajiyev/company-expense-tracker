import { supabase } from '../../lib/supabase'
import type { Debt, DebtInput, DebtPayment, DebtPaymentInput, DebtStatus } from './types'
import { fetchAllPages } from '../../lib/pagination'
import { sumMoney } from '../../lib/money'

type DebtRow = Omit<Debt, 'payments' | 'paid_amount' | 'status'>

function toDebt(row: DebtRow, payments: DebtPayment[]): Debt {
  const paidAmount = sumMoney(payments.map((payment) => Number(payment.amount)))
  const status: DebtStatus = paidAmount === 0 ? 'unpaid' : paidAmount >= Number(row.amount) ? 'paid' : 'partially_paid'
  return { ...row, payments, paid_amount: paidAmount, status }
}

export async function getDebts() {
  const [rows, paymentRows] = await Promise.all([
    fetchAllPages<DebtRow>(async (from, to) => {
      const { data, error } = await supabase.from('worker_debts').select('*').order('debt_date', { ascending: false }).order('created_at', { ascending: false }).order('id').range(from, to)
      return { data: data as DebtRow[] | null, error }
    }),
    fetchAllPages<DebtPayment>(async (from, to) => {
      const { data, error } = await supabase.from('worker_debt_payments').select('*').order('payment_date', { ascending: false }).order('created_at', { ascending: false }).order('id').range(from, to)
      return { data: data as DebtPayment[] | null, error }
    }),
  ])
  const paymentsByDebt = new Map<string, DebtPayment[]>()
  paymentRows.forEach((payment) => {
    const debtPayments = paymentsByDebt.get(payment.debt_id) ?? []
    debtPayments.push(payment)
    paymentsByDebt.set(payment.debt_id, debtPayments)
  })
  return rows.map((row) => toDebt(row, paymentsByDebt.get(row.id) ?? []))
}

export async function createDebt(input: DebtInput) {
  const { data, error } = await supabase.from('worker_debts').insert(input).select().single()
  if (error) throw error
  return toDebt(data as DebtRow, [])
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

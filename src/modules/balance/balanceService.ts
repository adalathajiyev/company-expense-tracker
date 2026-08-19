import { supabase } from '../../lib/supabase'
import type { BalanceAdjustment, BalanceAdjustmentInput, CashBalance } from './types'

export async function getCashBalance() {
  const { data, error } = await supabase.from('cash_balance').select('*').single()
  if (error) throw error
  return data as CashBalance
}

export async function getBalanceAdjustments() {
  const { data, error } = await supabase.from('balance_adjustments').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as BalanceAdjustment[]
}

export async function createBalanceAdjustment(input: BalanceAdjustmentInput) {
  const { data, error } = await supabase.from('balance_adjustments').insert(input).select().single()
  if (error) throw error
  return data as BalanceAdjustment
}

export async function removeBalanceAdjustment(id: string) {
  const { error } = await supabase.from('balance_adjustments').delete().eq('id', id)
  if (error) throw error
}

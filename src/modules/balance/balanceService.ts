import { supabase } from '../../lib/supabase'
import type { BalanceAdjustment, BalanceAdjustmentInput, BalanceAdjustmentSettlement, BalanceAdjustmentSettlementInput, CashBalance } from './types'
import { fetchAllPages } from '../../lib/pagination'
import { calculateAdjustmentAmounts } from './balanceCalculations'

type BalanceAdjustmentRow = Omit<BalanceAdjustment, 'settlements' | 'settled_amount' | 'remaining_amount' | 'status'> & {
  balance_adjustment_settlements: BalanceAdjustmentSettlement[] | null
}

function mapBalanceAdjustment(row: BalanceAdjustmentRow): BalanceAdjustment {
  const settlements = [...(row.balance_adjustment_settlements ?? [])]
    .map((settlement) => ({ ...settlement, amount: Number(settlement.amount) }))
    .sort((left, right) => right.payment_date.localeCompare(left.payment_date) || right.created_at.localeCompare(left.created_at))
  const amount = Number(row.amount)
  const { settledAmount, remainingAmount, status } = calculateAdjustmentAmounts(amount, settlements.map((settlement) => settlement.amount))

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    amount,
    direction: row.direction,
    created_at: row.created_at,
    settlements,
    settled_amount: settledAmount,
    remaining_amount: remainingAmount,
    status,
  }
}

export async function getCashBalance() {
  const { data, error } = await supabase.from('cash_balance').select('*').single()
  if (error) throw error
  return data as CashBalance
}

export async function getBalanceAdjustments() {
  const rows = await fetchAllPages<BalanceAdjustmentRow>(async (from, to) => {
    const { data, error } = await supabase
      .from('balance_adjustments')
      .select('*, balance_adjustment_settlements(*)')
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to)
    return { data: data as BalanceAdjustmentRow[] | null, error }
  })
  return rows.map(mapBalanceAdjustment)
}

export async function createBalanceAdjustment(input: BalanceAdjustmentInput) {
  const { error } = await supabase.from('balance_adjustments').insert(input)
  if (error) throw error
}

export async function createBalanceAdjustmentSettlement(input: BalanceAdjustmentSettlementInput) {
  const { error } = await supabase.from('balance_adjustment_settlements').insert({
    ...input,
    cash_account_id: input.payment_method === 'Cash' ? input.cash_account_id : null,
    note: input.note?.trim() || null,
  })
  if (error) throw error
}

export async function removeBalanceAdjustmentSettlement(id: string) {
  const { error } = await supabase.from('balance_adjustment_settlements').delete().eq('id', id)
  if (error) throw error
}

export async function removeBalanceAdjustment(id: string) {
  const { error } = await supabase.from('balance_adjustments').delete().eq('id', id)
  if (error) throw error
}

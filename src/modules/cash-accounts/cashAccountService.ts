import { supabase } from '../../lib/supabase'
import { fetchAllPages } from '../../lib/pagination'
import { getManagedUsers } from '../access/accessService'
import type {
  CashAccount,
  CashAccountInput,
  CashAccountUser,
  CashLedgerEntry,
  CashReconciliation,
  CashReconciliationInput,
  CashTransferInput,
} from './types'

export async function getCashAccounts() {
  return fetchAllPages<CashAccount>(async (from, to) => {
    const { data, error } = await supabase
      .from('cash_account_balances')
      .select('*')
      .order('account_type')
      .order('name')
      .order('id')
      .range(from, to)
    return { data: data as CashAccount[] | null, error }
  })
}

export async function getCashLedger() {
  return fetchAllPages<CashLedgerEntry>(async (from, to) => {
    const { data, error } = await supabase
      .from('cash_account_ledger')
      .select('*')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('entry_key')
      .range(from, to)
    return { data: data as CashLedgerEntry[] | null, error }
  })
}

export async function getCashReconciliations() {
  return fetchAllPages<CashReconciliation>(async (from, to) => {
    const { data, error } = await supabase
      .from('cash_reconciliations')
      .select('*')
      .order('reconciliation_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to)
    return { data: data as CashReconciliation[] | null, error }
  })
}

export async function getCashAccountUsers(): Promise<CashAccountUser[]> {
  const users = await getManagedUsers()
  return users
    .filter((user) => user.role !== null)
    .map(({ user_id, email, role }) => ({ user_id, email, role }))
}

export async function createCashAccount(input: CashAccountInput) {
  const { data, error } = await supabase.rpc('create_cash_account', {
    p_name: input.name,
    p_account_type: input.account_type,
    p_description: input.description,
    p_custodian_user_id: input.custodian_user_id,
  })
  if (error) throw error
  return data as string
}

export async function createCashTransfer(input: CashTransferInput) {
  const { error } = await supabase.from('cash_transfers').insert({
    ...input,
    description: input.description?.trim() || null,
  })
  if (error) throw error
}

export async function createCashReconciliation(input: CashReconciliationInput) {
  const { error } = await supabase.from('cash_reconciliations').insert({
    ...input,
    expected_balance: 0,
    variance: 0,
    notes: input.notes?.trim() || null,
  })
  if (error) throw error
}

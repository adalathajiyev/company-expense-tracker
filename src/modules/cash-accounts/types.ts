import type { AppRole } from '../access/types'

export type CashAccountType = 'main' | 'project' | 'employee_float'
export type CashEntryDirection = 'inflow' | 'outflow'

export interface CashAccount {
  id: string
  name: string
  account_type: CashAccountType
  description: string | null
  custodian_user_id: string | null
  custodian_email: string | null
  is_active: boolean
  balance: number
  last_activity_date: string | null
  created_at: string
}

export interface CashLedgerEntry {
  entry_key: string
  account_id: string
  transaction_date: string
  kind: string
  direction: CashEntryDirection
  amount: number
  description: string
  source_type: string
  source_id: string
  created_by_email: string | null
  created_at: string
}

export interface CashReconciliation {
  id: string
  account_id: string
  reconciliation_date: string
  expected_balance: number
  counted_balance: number
  variance: number
  notes: string | null
  created_by: string | null
  created_by_email: string
  created_at: string
}

export interface CashAccountUser {
  user_id: string
  email: string | null
  role: AppRole | null
}

export interface CashAccountInput {
  name: string
  account_type: Exclude<CashAccountType, 'main'>
  description: string | null
  custodian_user_id: string | null
}

export interface CashTransferInput {
  transfer_date: string
  from_account_id: string
  to_account_id: string
  amount: number
  description: string | null
}

export interface CashReconciliationInput {
  account_id: string
  reconciliation_date: string
  counted_balance: number
  notes: string | null
}

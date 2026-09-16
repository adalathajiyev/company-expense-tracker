import { describe, expect, it } from 'vitest'
import { getDefaultTransferAccountIds, sortCashAccountsMainFirst } from '../src/modules/cash-accounts/cashAccountOrdering'
import type { CashAccount } from '../src/modules/cash-accounts/types'

function account(id: string, accountType: CashAccount['account_type'], isActive = true): CashAccount {
  return {
    id,
    name: id,
    account_type: accountType,
    description: null,
    custodian_user_id: null,
    custodian_email: null,
    is_active: isActive,
    balance: 0,
    last_activity_date: null,
    created_at: '2026-01-01T00:00:00Z',
  }
}

describe('cash account ordering', () => {
  it('pins Main Cash first without changing the relative order of other accounts', () => {
    const accounts = [account('employee', 'employee_float'), account('project', 'project'), account('main', 'main')]
    expect(sortCashAccountsMainFirst(accounts).map((item) => item.id)).toEqual(['main', 'employee', 'project'])
  })

  it('uses active Main Cash as the default transfer source', () => {
    const accounts = [account('project', 'project'), account('main', 'main'), account('employee', 'employee_float')]
    expect(getDefaultTransferAccountIds(accounts)).toEqual({ fromAccountId: 'main', toAccountId: 'project' })
  })

  it('falls back to the first active account when Main Cash is unavailable', () => {
    const accounts = [account('project', 'project'), account('main', 'main', false), account('employee', 'employee_float')]
    expect(getDefaultTransferAccountIds(accounts)).toEqual({ fromAccountId: 'project', toAccountId: 'employee' })
  })
})

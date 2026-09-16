import { describe, expect, it } from 'vitest'
import { canDeleteCashTransfer } from '../src/modules/cash-accounts/cashTransferDeletion'

describe('cash transfer deletion access', () => {
  it('allows Administrators to delete transfers', () => {
    expect(canDeleteCashTransfer('admin')).toBe(true)
  })

  it('blocks every non-Administrator role', () => {
    expect(canDeleteCashTransfer('main_accountant')).toBe(false)
    expect(canDeleteCashTransfer('office_accountant')).toBe(false)
    expect(canDeleteCashTransfer('project_lead')).toBe(false)
  })
})

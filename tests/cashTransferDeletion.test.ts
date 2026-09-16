import { describe, expect, it } from 'vitest'
import { canDeleteCashTransfer, cashTransferDeleteWindowMs } from '../src/modules/cash-accounts/cashTransferDeletion'

const now = new Date('2026-09-16T12:00:00.000Z')

describe('cash transfer deletion window', () => {
  it('allows deletion before 24 hours have elapsed', () => {
    const createdAt = new Date(now.getTime() - cashTransferDeleteWindowMs + 1).toISOString()
    expect(canDeleteCashTransfer(createdAt, now)).toBe(true)
  })

  it('blocks deletion exactly 24 hours after creation and later', () => {
    const exactlyOneDayOld = new Date(now.getTime() - cashTransferDeleteWindowMs).toISOString()
    const older = new Date(now.getTime() - cashTransferDeleteWindowMs - 1).toISOString()
    expect(canDeleteCashTransfer(exactlyOneDayOld, now)).toBe(false)
    expect(canDeleteCashTransfer(older, now)).toBe(false)
  })

  it('blocks invalid creation timestamps', () => {
    expect(canDeleteCashTransfer('not-a-date', now)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { calculateCashLedgerPeriodSummary, filterCashLedgerEntries } from '../src/modules/cash-accounts/cashLedgerCalculations'
import type { CashLedgerEntry } from '../src/modules/cash-accounts/types'

function entry(id: string, date: string, kind: string, direction: 'inflow' | 'outflow', amount: number): CashLedgerEntry {
  return {
    entry_key: id,
    account_id: 'account-1',
    transaction_date: date,
    kind,
    direction,
    amount,
    description: `${kind} ${id}`,
    source_type: kind,
    source_id: id,
    created_by_email: 'accountant@example.com',
    created_at: `${date}T10:00:00Z`,
  }
}

const entries = [
  entry('opening', '2026-08-20', 'transfer', 'inflow', 1000),
  entry('transfer', '2026-09-02', 'transfer', 'inflow', 500),
  entry('expense', '2026-09-03', 'expense', 'outflow', 300),
  entry('salary', '2026-09-04', 'salary_payment', 'outflow', 100),
]

describe('cash ledger filtering', () => {
  it('can display only transfers for the selected month', () => {
    const result = filterCashLedgerEntries(entries, { period: 'month:2026-09', kind: 'transfers', direction: 'all', search: '' })
    expect(result.map((item) => item.entry_key)).toEqual(['transfer'])
  })

  it('supports a whole year and all dates', () => {
    expect(filterCashLedgerEntries(entries, { period: 'year:2026', kind: 'all', direction: 'all', search: '' })).toHaveLength(4)
    expect(filterCashLedgerEntries(entries, { period: 'all', kind: 'all', direction: 'all', search: '' })).toHaveLength(4)
  })
})

describe('cash ledger period summary', () => {
  it('calculates opening, incoming, outgoing, and closing balances for a month', () => {
    expect(calculateCashLedgerPeriodSummary(entries, 'month:2026-09')).toEqual({
      openingBalance: 1000,
      inflow: 500,
      outflow: 400,
      closingBalance: 1100,
    })
  })
})

import { sumMoney } from '../../lib/money'
import type { CashLedgerEntry } from './types'

export type LedgerKindFilter = 'transfers' | 'all' | 'expenses' | 'other'
export type LedgerDirectionFilter = 'all' | 'inflow' | 'outflow'

export interface CashLedgerFilters {
  period: string
  kind: LedgerKindFilter
  direction: LedgerDirectionFilter
  search: string
}

export interface CashLedgerPeriodSummary {
  openingBalance: number
  inflow: number
  outflow: number
  closingBalance: number
}

function matchesPeriod(date: string, period: string) {
  if (period === 'all') return true
  return date.startsWith(period.split(':')[1])
}

function signedAmount(entry: CashLedgerEntry) {
  return entry.direction === 'inflow' ? Number(entry.amount) : -Number(entry.amount)
}

export function filterCashLedgerEntries(entries: CashLedgerEntry[], filters: CashLedgerFilters) {
  const normalizedSearch = filters.search.trim().toLowerCase()
  return entries.filter((entry) => {
    const matchesKind = filters.kind === 'all'
      || (filters.kind === 'transfers' && entry.kind === 'transfer')
      || (filters.kind === 'expenses' && entry.kind === 'expense')
      || (filters.kind === 'other' && entry.kind !== 'transfer' && entry.kind !== 'expense')
    const matchesDirection = filters.direction === 'all' || entry.direction === filters.direction
    const matchesSearch = !normalizedSearch || `${entry.description} ${entry.created_by_email ?? ''} ${entry.kind}`.toLowerCase().includes(normalizedSearch)
    return matchesPeriod(entry.transaction_date, filters.period) && matchesKind && matchesDirection && matchesSearch
  })
}

export function calculateCashLedgerPeriodSummary(entries: CashLedgerEntry[], period: string): CashLedgerPeriodSummary {
  const periodEntries = entries.filter((entry) => matchesPeriod(entry.transaction_date, period))
  const periodStart = period === 'all' ? null : period.startsWith('month:') ? `${period.split(':')[1]}-01` : `${period.split(':')[1]}-01-01`
  const openingBalance = periodStart === null ? 0 : sumMoney(entries.filter((entry) => entry.transaction_date < periodStart).map(signedAmount))
  const inflow = sumMoney(periodEntries.filter((entry) => entry.direction === 'inflow').map((entry) => Number(entry.amount)))
  const outflow = sumMoney(periodEntries.filter((entry) => entry.direction === 'outflow').map((entry) => Number(entry.amount)))
  return { openingBalance, inflow, outflow, closingBalance: sumMoney([openingBalance, inflow, -outflow]) }
}

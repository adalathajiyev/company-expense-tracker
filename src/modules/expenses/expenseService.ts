import { supabase } from '../../lib/supabase'
import type { Expense, ExpenseInput } from './types'
import { fetchAllPages } from '../../lib/pagination'

interface ExpenseRow extends Omit<Expense, 'cash_account_name' | 'project_name' | 'fuel_card_name' | 'fuel_card_number' | 'truck_name' | 'truck_registration_number'> {
  cash_accounts: { name: string } | null
  projects: { name: string } | null
  fuel_cards: { name: string; card_number: string } | null
  trucks: { name: string; registration_number: string } | null
}

function toExpense(row: ExpenseRow): Expense {
  const { cash_accounts: account, projects: project, fuel_cards: fuelCard, trucks: truck, ...expense } = row
  return {
    ...expense,
    cash_account_name: account?.name ?? null,
    project_name: project?.name ?? null,
    fuel_card_name: fuelCard?.name ?? null,
    fuel_card_number: fuelCard?.card_number ?? null,
    truck_name: truck?.name ?? null,
    truck_registration_number: truck?.registration_number ?? null,
  }
}

export async function getExpenses() {
  const rows = await fetchAllPages<ExpenseRow>(async (from, to) => {
    const { data, error } = await supabase.from('expenses').select('*, cash_accounts(name), projects(name), fuel_cards(name, card_number), trucks(name, registration_number)').order('expense_date', { ascending: false }).order('created_at', { ascending: false }).order('id').range(from, to)
    return { data: data as ExpenseRow[] | null, error }
  })
  return rows.map(toExpense)
}

export async function createExpense(input: ExpenseInput) {
  const { data, error } = await supabase.from('expenses').insert(input).select('*, cash_accounts(name), projects(name), fuel_cards(name, card_number), trucks(name, registration_number)').single()
  if (error) throw error
  return toExpense(data as ExpenseRow)
}

export async function removeExpense(id: string) {
  const { data, error } = await supabase.from('expenses').delete().eq('id', id).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Only the creator or an Admin can delete this expense.')
}

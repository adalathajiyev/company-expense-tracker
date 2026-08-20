import { supabase } from '../../lib/supabase'
import type { Expense, ExpenseInput } from './types'
import { fetchAllPages } from '../../lib/pagination'

export async function getExpenses() {
  return fetchAllPages<Expense>(async (from, to) => {
    const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false }).order('created_at', { ascending: false }).order('id').range(from, to)
    return { data: data as Expense[] | null, error }
  })
}

export async function createExpense(input: ExpenseInput) {
  const { data, error } = await supabase.from('expenses').insert(input).select().single()
  if (error) throw error
  return data as Expense
}

export async function removeExpense(id: string) {
  const { data, error } = await supabase.from('expenses').delete().eq('id', id).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Only the creator or an Admin can delete this expense.')
}

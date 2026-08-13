import { supabase } from '../../lib/supabase'
import type { Expense, ExpenseInput } from './types'

export async function getExpenses() {
  const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false })
  if (error) throw error
  return data as Expense[]
}

export async function createExpense(input: ExpenseInput) {
  const { data, error } = await supabase.from('expenses').insert(input).select().single()
  if (error) throw error
  return data as Expense
}

export async function removeExpense(id: string) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

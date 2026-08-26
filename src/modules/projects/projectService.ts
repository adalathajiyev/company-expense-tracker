import { supabase } from '../../lib/supabase'
import { fetchAllPages } from '../../lib/pagination'
import type { Expense } from '../expenses/types'
import type { Project, ProjectInput, ProjectOption } from './types'

interface ProjectExpenseRow extends Omit<Expense, 'cash_account_name' | 'project_name'> {
  cash_accounts: { name: string } | null
  projects: { name: string } | null
}

function toProjectExpense(row: ProjectExpenseRow): Expense {
  const { cash_accounts: account, projects: project, ...expense } = row
  return {
    ...expense,
    cash_account_name: account?.name ?? null,
    project_name: project?.name ?? null,
  }
}

export async function getProjects() {
  return fetchAllPages<Project>(async (from, to) => {
    const { data, error } = await supabase
      .from('project_cost_summary')
      .select('*')
      .order('name')
      .order('id')
      .range(from, to)
    return { data: data as Project[] | null, error }
  })
}

export async function getProjectOptions() {
  const rows = await fetchAllPages<ProjectOption>(async (from, to) => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, location, status')
      .order('name')
      .order('id')
      .range(from, to)
    return { data: data as ProjectOption[] | null, error }
  })
  return rows
}

async function getProject(id: string) {
  const { data, error } = await supabase
    .from('project_cost_summary')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Project
}

export async function createProject(input: ProjectInput) {
  const { data, error } = await supabase
    .from('projects')
    .insert({ ...input, created_by_email: '' })
    .select('id')
    .single()
  if (error) throw error
  return getProject(data.id)
}

export async function updateProject(id: string, input: ProjectInput) {
  const { data, error } = await supabase
    .from('projects')
    .update(input)
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('The project could not be updated.')
  return getProject(id)
}

async function getProjectExpenseRows(projectId: string | null) {
  const rows = await fetchAllPages<ProjectExpenseRow>(async (from, to) => {
    let query = supabase
      .from('expenses')
      .select('*, cash_accounts(name), projects(name)')
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')

    query = projectId === null ? query.is('project_id', null) : query.eq('project_id', projectId)
    const { data, error } = await query.range(from, to)
    return { data: data as ProjectExpenseRow[] | null, error }
  })
  return rows.map(toProjectExpense)
}

export function getProjectExpenses(projectId: string) {
  return getProjectExpenseRows(projectId)
}

export async function getAssignableExpenses() {
  const expenses = await getProjectExpenseRows(null)
  return expenses.filter((expense) => !expense.salary_source_id)
}

export async function assignExpensesToProject(projectId: string, expenseIds: string[]) {
  if (expenseIds.length === 0) return
  const { data, error } = await supabase
    .from('expenses')
    .update({ project_id: projectId })
    .in('id', expenseIds)
    .is('project_id', null)
    .is('salary_source_id', null)
    .select('id')
  if (error) throw error
  if ((data?.length ?? 0) !== expenseIds.length) {
    throw new Error('Some expenses were already assigned or could not be updated. Refresh and try again.')
  }
}

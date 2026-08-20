import { supabase } from '../../lib/supabase'
import type { AppRole, ManagedUser } from './types'
import { fetchAllPages } from '../../lib/pagination'

export async function getCurrentUserRole(userId: string): Promise<AppRole | null> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return (data?.role as AppRole | undefined) ?? null
}

export async function getManagedUsers(): Promise<ManagedUser[]> {
  const [directoryResult, rolesResult] = await Promise.all([
    fetchAllPages<Pick<ManagedUser, 'user_id' | 'email' | 'created_at' | 'last_sign_in_at'>>(async (from, to) => {
      const { data, error } = await supabase.from('user_directory').select('user_id, email, created_at, last_sign_in_at').order('created_at').order('user_id').range(from, to)
      return { data, error }
    }),
    fetchAllPages<Pick<ManagedUser, 'user_id' | 'role'>>(async (from, to) => {
      const { data, error } = await supabase.from('user_roles').select('user_id, role').order('user_id').range(from, to)
      return { data: data as Pick<ManagedUser, 'user_id' | 'role'>[] | null, error }
    }),
  ])

  const roles = new Map(rolesResult.map((row) => [row.user_id, row.role as AppRole]))
  return directoryResult.map((user) => ({
    ...user,
    role: roles.get(user.user_id) ?? null,
  })) as ManagedUser[]
}

export async function setUserRole(userId: string, role: AppRole) {
  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id' })

  if (error) throw error
}

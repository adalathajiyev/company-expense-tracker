import { supabase } from '../../lib/supabase'
import type { OwnerFunding, OwnerFundingInput } from './types'
import { fetchAllPages } from '../../lib/pagination'

export async function getOwnerFunding() {
  return fetchAllPages<OwnerFunding>(async (from, to) => {
    const { data, error } = await supabase.from('owner_funding').select('*').order('funding_date', { ascending: false }).order('created_at', { ascending: false }).order('id').range(from, to)
    return { data: data as OwnerFunding[] | null, error }
  })
}

export async function createOwnerFunding(input: OwnerFundingInput) {
  const { data, error } = await supabase.from('owner_funding').insert(input).select().single()
  if (error) throw error
  return data as OwnerFunding
}

export async function removeOwnerFunding(id: string) {
  const { data, error } = await supabase.from('owner_funding').delete().eq('id', id).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Only the creator or an Admin can delete this owner funding entry.')
}

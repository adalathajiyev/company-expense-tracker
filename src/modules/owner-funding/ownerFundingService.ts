import { supabase } from '../../lib/supabase'
import type { OwnerFunding, OwnerFundingInput } from './types'

export async function getOwnerFunding() {
  const { data, error } = await supabase.from('owner_funding').select('*').order('funding_date', { ascending: false })
  if (error) throw error
  return data as OwnerFunding[]
}

export async function createOwnerFunding(input: OwnerFundingInput) {
  const { data, error } = await supabase.from('owner_funding').insert(input).select().single()
  if (error) throw error
  return data as OwnerFunding
}

export async function removeOwnerFunding(id: string) {
  const { error } = await supabase.from('owner_funding').delete().eq('id', id)
  if (error) throw error
}

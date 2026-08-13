import { supabase } from '../../lib/supabase'
import type { Sale, SaleInput } from './types'

export async function getSales() {
  const { data, error } = await supabase.from('sales').select('*').order('sale_date', { ascending: false })
  if (error) throw error
  return data as Sale[]
}

export async function createSale(input: SaleInput) {
  const { data, error } = await supabase.from('sales').insert(input).select().single()
  if (error) throw error
  return data as Sale
}

export async function removeSale(id: string) {
  const { error } = await supabase.from('sales').delete().eq('id', id)
  if (error) throw error
}

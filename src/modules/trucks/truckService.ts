import { supabase } from '../../lib/supabase'
import { fetchAllPages } from '../../lib/pagination'
import type {
  FuelCardAllocationInput,
  FuelCardBalance,
  FuelCardInput,
  FuelCardLedgerEntry,
  FuelProviderBalance,
  FuelProviderInput,
  FuelProviderTopupInput,
  TruckInput,
  TruckSummary,
} from './types'

export async function getTruckSummaries() {
  return fetchAllPages<TruckSummary>(async (from, to) => {
    const { data, error } = await supabase.from('truck_cost_summary').select('*').order('is_active', { ascending: false }).order('name').order('id').range(from, to)
    return { data: data as TruckSummary[] | null, error }
  })
}

export async function getFuelProviderBalances() {
  return fetchAllPages<FuelProviderBalance>(async (from, to) => {
    const { data, error } = await supabase.from('fuel_provider_balances').select('*').order('is_active', { ascending: false }).order('name').order('id').range(from, to)
    return { data: data as FuelProviderBalance[] | null, error }
  })
}

export async function getFuelCardBalances() {
  return fetchAllPages<FuelCardBalance>(async (from, to) => {
    const { data, error } = await supabase.from('fuel_card_balances').select('*').order('is_active', { ascending: false }).order('provider_name').order('name').order('id').range(from, to)
    return { data: data as FuelCardBalance[] | null, error }
  })
}

export async function getFuelCardLedger() {
  return fetchAllPages<FuelCardLedgerEntry>(async (from, to) => {
    const { data, error } = await supabase.from('fuel_card_ledger').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).order('entry_key').range(from, to)
    return { data: data as FuelCardLedgerEntry[] | null, error }
  })
}

export async function createTruck(input: TruckInput) {
  const { error } = await supabase.from('trucks').insert({
    ...input,
    name: input.name.trim(),
    registration_number: input.registration_number.trim(),
    make_model: input.make_model?.trim() || null,
    notes: input.notes?.trim() || null,
  })
  if (error) throw error
}

export async function createFuelProvider(input: FuelProviderInput) {
  const { error } = await supabase.from('fuel_providers').insert({ name: input.name.trim(), notes: input.notes?.trim() || null })
  if (error) throw error
}

export async function createFuelCard(input: FuelCardInput) {
  const { error } = await supabase.from('fuel_cards').insert({
    ...input,
    name: input.name.trim(),
    card_number: input.card_number.trim(),
    custodian_name: input.custodian_name?.trim() || null,
    notes: input.notes?.trim() || null,
  })
  if (error) throw error
}

export async function createFuelProviderTopup(input: FuelProviderTopupInput) {
  const { error } = await supabase.from('fuel_provider_topups').insert({
    ...input,
    bank_reference: input.bank_reference?.trim() || null,
    notes: input.notes?.trim() || null,
  })
  if (error) throw error
}

export async function createFuelCardAllocation(input: FuelCardAllocationInput) {
  const { error } = await supabase.from('fuel_card_allocations').insert({ ...input, notes: input.notes?.trim() || null })
  if (error) throw error
}

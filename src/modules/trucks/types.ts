export type FuelCardAssignmentType = 'truck' | 'project' | 'cash_account' | 'factory' | 'unassigned'
export type FuelAllocationType = 'allocate' | 'return'

export interface TruckSummary {
  id: string
  name: string
  registration_number: string
  make_model: string | null
  tank_capacity_liters: number
  is_active: boolean
  notes: string | null
  created_by: string | null
  created_by_email: string
  created_at: string
  total_cost: number
  fuel_cost: number
  fuel_liters: number
  latest_tank_reading_liters: number | null
  last_tank_reading_date: string | null
  expense_count: number
  last_expense_date: string | null
}

export interface FuelProviderBalance {
  id: string
  name: string
  is_active: boolean
  notes: string | null
  created_by: string | null
  created_by_email: string
  created_at: string
  topped_up_amount: number
  allocated_amount: number
  returned_amount: number
  purchased_amount: number
  main_balance: number
  cards_balance: number
  total_prepaid_balance: number
  last_topup_date: string | null
}

export interface FuelCardBalance {
  id: string
  provider_id: string
  provider_name: string
  name: string
  card_number: string
  assignment_type: FuelCardAssignmentType
  truck_id: string | null
  truck_name: string | null
  truck_registration_number: string | null
  project_id: string | null
  project_name: string | null
  cash_account_id: string | null
  cash_account_name: string | null
  custodian_name: string | null
  is_active: boolean
  notes: string | null
  created_by: string | null
  created_by_email: string
  created_at: string
  allocated_amount: number
  returned_amount: number
  purchased_amount: number
  balance: number
  last_activity_date: string | null
}

export interface FuelCardLedgerEntry {
  entry_key: string
  card_id: string
  transaction_date: string
  kind: string
  direction: 'inflow' | 'outflow'
  amount: number
  description: string
  created_by_email: string
  created_at: string
}

export interface TruckInput {
  name: string
  registration_number: string
  make_model: string | null
  tank_capacity_liters: number
  notes: string | null
}

export interface FuelProviderInput {
  name: string
  notes: string | null
}

export interface FuelCardInput {
  provider_id: string
  name: string
  card_number: string
  assignment_type: FuelCardAssignmentType
  truck_id: string | null
  project_id: string | null
  cash_account_id: string | null
  custodian_name: string | null
  notes: string | null
}

export interface FuelProviderTopupInput {
  provider_id: string
  topup_date: string
  amount: number
  bank_reference: string | null
  notes: string | null
}

export interface FuelCardAllocationInput {
  card_id: string
  allocation_date: string
  allocation_type: FuelAllocationType
  amount: number
  notes: string | null
}

export const fuelCardAssignmentLabels: Record<FuelCardAssignmentType, string> = {
  truck: 'Truck',
  project: 'Project',
  cash_account: 'Cash account',
  factory: 'Main factory',
  unassigned: 'Unassigned',
}

export function getFuelCardAssignment(card: Pick<FuelCardBalance, 'assignment_type' | 'truck_name' | 'truck_registration_number' | 'project_name' | 'cash_account_name'>) {
  if (card.assignment_type === 'truck') return [card.truck_name, card.truck_registration_number].filter(Boolean).join(' · ')
  if (card.assignment_type === 'project') return card.project_name ?? 'Project'
  if (card.assignment_type === 'cash_account') return card.cash_account_name ?? 'Cash account'
  return fuelCardAssignmentLabels[card.assignment_type]
}

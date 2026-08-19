export type OwnerFundingDirection = 'incoming' | 'outgoing'

export interface OwnerFunding {
  id: string
  funding_date: string
  owner_name: string
  description: string | null
  payment_method: string
  direction: OwnerFundingDirection
  amount: number
  created_at: string
}

export type OwnerFundingInput = Omit<OwnerFunding, 'id' | 'created_at'>

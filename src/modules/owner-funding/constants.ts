import type { OwnerFundingInput } from './types'

export const fundingDirections = ['incoming', 'outgoing'] as const

export const emptyFunding: OwnerFundingInput = { funding_date: new Date().toISOString().slice(0, 10), owner_name: '', description: '', payment_method: 'Cash', direction: 'incoming', amount: 0 }

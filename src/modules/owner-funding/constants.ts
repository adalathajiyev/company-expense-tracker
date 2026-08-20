import type { OwnerFundingInput } from './types'
import { getBusinessDate } from '../../lib/businessDate'

export const fundingDirections = ['incoming', 'outgoing'] as const

export function createEmptyFunding(): OwnerFundingInput {
  return { funding_date: getBusinessDate(), owner_name: '', description: '', payment_method: 'Cash', direction: 'incoming', amount: 0 }
}

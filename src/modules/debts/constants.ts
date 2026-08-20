import type { DebtInput } from './types'
import { getBusinessDate } from '../../lib/businessDate'

export function createEmptyDebt(): DebtInput {
  return { debt_date: getBusinessDate(), worker_name: '', description: '', amount: 0 }
}

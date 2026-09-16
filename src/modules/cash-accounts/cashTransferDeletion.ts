import type { AppRole } from '../access/types'

export function canDeleteCashTransfer(role: AppRole) {
  return role === 'admin'
}

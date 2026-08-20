export type AppRole = 'admin' | 'main_accountant' | 'office_accountant'

export interface ManagedUser {
  user_id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  role: AppRole | null
}

export const roleLabels: Record<AppRole, string> = {
  admin: 'Admin',
  main_accountant: 'Main Accountant',
  office_accountant: 'Office Accountant',
}

export function hasFullAccess(role: AppRole) {
  return role === 'admin' || role === 'main_accountant'
}

export function canDeleteOwnedRecord(role: AppRole, currentUserId: string, createdBy: string | null) {
  return role === 'admin' || createdBy === currentUserId
}

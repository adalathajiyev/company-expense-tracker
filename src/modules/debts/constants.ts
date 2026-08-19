import type { DebtInput } from './types'

export const emptyDebt: DebtInput = { debt_date: new Date().toISOString().slice(0, 10), worker_name: '', description: '', amount: 0 }

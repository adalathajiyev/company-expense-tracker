import { roundMoney } from '../../lib/money'

export interface SalaryForPaymentAllocation {
  id: string
  employee_id: string
  salary_month: string
  closed_at: string | null
  days_worked: number
  daily_rate_snapshot: number
  meal_count: number
  meal_rate_snapshot: number
}

export interface PaymentForSalaryAllocation {
  id: string
  employee_id: string
  origin_salary_month: string
  payment_type: 'cash_payment' | 'card_transfer'
  payment_date: string
  created_at: string
  remaining_amount: number
}

function paymentOrder(left: PaymentForSalaryAllocation, right: PaymentForSalaryAllocation) {
  if (left.payment_type !== right.payment_type) return left.payment_type === 'card_transfer' ? -1 : 1
  return left.payment_date.localeCompare(right.payment_date)
    || left.created_at.localeCompare(right.created_at)
    || left.id.localeCompare(right.id)
}

function netSalary(row: SalaryForPaymentAllocation) {
  return Math.max(roundMoney(Number(row.days_worked) * Number(row.daily_rate_snapshot) - Number(row.meal_count) * Number(row.meal_rate_snapshot)), 0)
}

export function assignOpenSalaryPayments<T extends PaymentForSalaryAllocation>(
  rows: SalaryForPaymentAllocation[],
  availablePayments: T[],
) {
  const assignments = new Map<string, T[]>()
  const remaining = new Map(availablePayments.map((payment) => [payment.id, Number(payment.remaining_amount)]))
  const employeeIds = [...new Set(rows.filter((row) => !row.closed_at).map((row) => row.employee_id))]

  for (const employeeId of employeeIds) {
    const openSalaries = rows
      .filter((row) => row.employee_id === employeeId && !row.closed_at)
      .sort((left, right) => left.salary_month.localeCompare(right.salary_month))

    openSalaries.forEach((salary, salaryIndex) => {
      const assigned: T[] = []
      let amountNeeded = netSalary(salary)
      const candidates = availablePayments
        .filter((payment) => payment.employee_id === employeeId && payment.origin_salary_month <= salary.salary_month)
        .sort(paymentOrder)

      for (const payment of candidates) {
        const available = remaining.get(payment.id) ?? 0
        if (available <= 0 || amountNeeded <= 0) continue
        const amount = Math.min(available, amountNeeded)
        assigned.push({ ...payment, remaining_amount: roundMoney(amount) })
        remaining.set(payment.id, roundMoney(available - amount))
        amountNeeded = roundMoney(amountNeeded - amount)
      }

      // Only the newest open month displays unallocated excess as credit. This
      // preserves the overpaid warning without counting the same payment twice.
      if (salaryIndex === openSalaries.length - 1) {
        for (const payment of candidates) {
          const available = remaining.get(payment.id) ?? 0
          if (available <= 0) continue
          const existingIndex = assigned.findIndex((item) => item.id === payment.id)
          if (existingIndex >= 0) {
            assigned[existingIndex] = {
              ...assigned[existingIndex],
              remaining_amount: roundMoney(assigned[existingIndex].remaining_amount + available),
            }
          } else {
            assigned.push({ ...payment, remaining_amount: available })
          }
          remaining.set(payment.id, 0)
        }
      }

      assignments.set(salary.id, assigned)
    })
  }

  return assignments
}

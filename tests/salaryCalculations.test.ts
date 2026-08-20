import { describe, expect, it } from 'vitest'
import { assignOpenSalaryPayments, type PaymentForSalaryAllocation, type SalaryForPaymentAllocation } from '../src/modules/salaries/salaryCalculations'

function salary(id: string, month: string): SalaryForPaymentAllocation {
  return {
    id,
    employee_id: 'employee-1',
    salary_month: month,
    closed_at: null,
    days_worked: 10,
    daily_rate_snapshot: 10,
    meal_count: 0,
    meal_rate_snapshot: 1.5,
  }
}

function payment(amount: number): PaymentForSalaryAllocation {
  return {
    id: 'payment-1',
    employee_id: 'employee-1',
    origin_salary_month: '2026-06-01',
    payment_type: 'cash_payment',
    payment_date: '2026-06-20',
    created_at: '2026-06-20T10:00:00Z',
    remaining_amount: amount,
  }
}

describe('open salary payment allocation', () => {
  it('does not count one payment in every open salary month', () => {
    const assignments = assignOpenSalaryPayments(
      [salary('june', '2026-06-01'), salary('july', '2026-07-01')],
      [payment(150)],
    )

    expect(assignments.get('june')?.[0].remaining_amount).toBe(100)
    expect(assignments.get('july')?.[0].remaining_amount).toBe(50)
  })

  it('shows excess only as credit on the newest open month', () => {
    const assignments = assignOpenSalaryPayments(
      [salary('june', '2026-06-01'), salary('july', '2026-07-01')],
      [payment(250)],
    )

    expect(assignments.get('june')?.[0].remaining_amount).toBe(100)
    expect(assignments.get('july')?.[0].remaining_amount).toBe(150)
  })
})

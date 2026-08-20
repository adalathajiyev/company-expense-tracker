export type SalaryPaymentType = 'cash_payment' | 'card_transfer'
export type SalaryStatus = 'draft' | 'in_progress' | 'paid' | 'overpaid' | 'closed'

export interface EmployeeRate {
  id: string
  employee_id: string
  daily_rate: number
  effective_from: string
  created_at: string
}

export interface Employee {
  id: string
  name: string
  active: boolean
  created_at: string
  rates: EmployeeRate[]
  current_rate: number | null
}

export interface SalaryPayment {
  id: string
  monthly_salary_id: string
  payment_date: string
  payment_type: SalaryPaymentType
  amount: number
  note: string | null
  created_at: string
}

export interface SalaryPaymentApplication extends SalaryPayment {
  applied_amount: number
  origin_salary_month: string
  can_delete: boolean
}

export interface MonthlySalary {
  id: string
  employee_id: string
  employee: Pick<Employee, 'id' | 'name'>
  salary_month: string
  daily_rate_snapshot: number
  days_worked: number
  meal_count: number
  meal_rate_snapshot: number
  notes: string | null
  closed_at: string | null
  closed_cash_amount: number
  closed_card_amount: number
  created_at: string
  updated_at: string
  payments: SalaryPaymentApplication[]
  gross_salary: number
  meal_deduction: number
  card_transferred: number
  cash_paid: number
  cash_credit: number
  card_credit: number
  total_paid: number
  receivable_salary: number
  status: SalaryStatus
}

export interface SalaryWorkInput {
  days_worked: number
  meal_count: number
  notes: string
}

export type SalaryPaymentInput = Omit<SalaryPayment, 'id' | 'created_at'>

export interface SalaryClosePreview {
  salary_id: string
  employee_id: string
  employee_name: string
  salary_month: string
  net_salary: number
  available_cash: number
  available_card: number
  cash_to_expense: number
  card_to_apply: number
  carryover_cash: number
  carryover_card: number
  outstanding: number
}

export interface SalaryMonthCloseResult {
  target_month: string
  closed_month: string
  already_closed: boolean
  salaries_closed: number
  expenses_created: number
  cash_expensed: number
  cash_credit_carried: number
  card_credit_carried: number
  salaries_created: number
}

import { supabase } from '../../lib/supabase'
import type { Employee, EmployeeRate, MonthlySalary, SalaryClosePreview, SalaryMonthCloseResult, SalaryPayment, SalaryPaymentInput, SalaryStatus, SalaryWorkInput } from './types'

interface EmployeeRow extends Omit<Employee, 'rates' | 'current_rate'> {
  employee_daily_rates: EmployeeRate[] | null
}

interface PaymentAllocationRow {
  monthly_salary_id: string
  amount: number
}

interface SalaryPaymentRow extends SalaryPayment {
  salary_payment_allocations: PaymentAllocationRow[] | null
}

interface SalaryRow extends Omit<MonthlySalary, 'employee' | 'payments' | 'gross_salary' | 'meal_deduction' | 'card_transferred' | 'cash_paid' | 'cash_credit' | 'card_credit' | 'total_paid' | 'receivable_salary' | 'status'> {
  employees: Pick<Employee, 'id' | 'name'>
  salary_payments: SalaryPaymentRow[] | null
}

interface AvailablePayment extends SalaryPaymentRow {
  employee_id: string
  origin_salary_month: string
  remaining_amount: number
}

function toEmployee(row: EmployeeRow): Employee {
  const rates = [...(row.employee_daily_rates ?? [])].sort((a, b) => b.effective_from.localeCompare(a.effective_from))
  const currentRate = rates.find((rate) => rate.effective_from <= new Date().toISOString().slice(0, 10))
  const { employee_daily_rates: _rates, ...employee } = row
  return { ...employee, rates, current_rate: currentRate ? Number(currentRate.daily_rate) : null }
}

function toSalary(row: SalaryRow, availablePayments: AvailablePayment[]): MonthlySalary {
  const paymentRows = row.salary_payments ?? []
  const payments = paymentRows.map(({ salary_payment_allocations: _allocations, ...payment }) => payment)
  const grossSalary = Number(row.days_worked) * Number(row.daily_rate_snapshot)
  const mealDeduction = Number(row.meal_count) * Number(row.meal_rate_snapshot)
  const eligiblePayments = row.closed_at ? [] : availablePayments.filter((payment) => payment.employee_id === row.employee_id && payment.origin_salary_month <= row.salary_month)
  const cardTransferred = row.closed_at
    ? Number(row.closed_card_amount)
    : eligiblePayments.filter((payment) => payment.payment_type === 'card_transfer').reduce((sum, payment) => sum + payment.remaining_amount, 0)
  const cashPaid = row.closed_at
    ? Number(row.closed_cash_amount)
    : eligiblePayments.filter((payment) => payment.payment_type === 'cash_payment').reduce((sum, payment) => sum + payment.remaining_amount, 0)
  const cashCredit = row.closed_at ? 0 : eligiblePayments.filter((payment) => payment.payment_type === 'cash_payment' && payment.origin_salary_month < row.salary_month).reduce((sum, payment) => sum + payment.remaining_amount, 0)
  const cardCredit = row.closed_at ? 0 : eligiblePayments.filter((payment) => payment.payment_type === 'card_transfer' && payment.origin_salary_month < row.salary_month).reduce((sum, payment) => sum + payment.remaining_amount, 0)
  const totalPaid = cardTransferred + cashPaid
  const receivableSalary = row.closed_at ? 0 : grossSalary - mealDeduction - totalPaid
  const status: SalaryStatus = row.closed_at ? 'closed' : receivableSalary < 0 ? 'overpaid' : receivableSalary === 0 && grossSalary > 0 ? 'paid' : totalPaid > 0 || grossSalary > 0 ? 'in_progress' : 'draft'
  const { employees, salary_payments: _payments, ...salary } = row
  return { ...salary, closed_cash_amount: Number(row.closed_cash_amount), closed_card_amount: Number(row.closed_card_amount), employee: employees, payments, gross_salary: grossSalary, meal_deduction: mealDeduction, card_transferred: cardTransferred, cash_paid: cashPaid, cash_credit: cashCredit, card_credit: cardCredit, total_paid: totalPaid, receivable_salary: receivableSalary, status }
}

export async function getEmployees() {
  const { data, error } = await supabase.from('employees').select('*, employee_daily_rates(*)').order('name').order('effective_from', { referencedTable: 'employee_daily_rates', ascending: false })
  if (error) throw error
  return (data as EmployeeRow[]).map(toEmployee)
}

export async function createEmployee(name: string, dailyRate: number, effectiveFrom: string) {
  const { data: employee, error: employeeError } = await supabase.from('employees').insert({ name }).select().single()
  if (employeeError) throw employeeError
  const { error: rateError } = await supabase.from('employee_daily_rates').insert({ employee_id: employee.id, daily_rate: dailyRate, effective_from: effectiveFrom })
  if (rateError) {
    await supabase.from('employees').delete().eq('id', employee.id)
    throw rateError
  }
}

export async function addEmployeeRate(employeeId: string, dailyRate: number, effectiveFrom: string) {
  const { error } = await supabase.from('employee_daily_rates').insert({ employee_id: employeeId, daily_rate: dailyRate, effective_from: effectiveFrom })
  if (error) throw error
}

export async function getSalaries() {
  const { data, error } = await supabase.from('monthly_salaries').select('*, employees(id, name), salary_payments(*, salary_payment_allocations(monthly_salary_id, amount))').order('salary_month', { ascending: false }).order('payment_date', { referencedTable: 'salary_payments', ascending: false })
  if (error) throw error
  const rows = data as SalaryRow[]
  const availablePayments = rows.flatMap((salary) => (salary.salary_payments ?? []).map((payment) => {
    const allocatedAmount = (payment.salary_payment_allocations ?? []).reduce((sum, allocation) => sum + Number(allocation.amount), 0)
    return { ...payment, employee_id: salary.employee_id, origin_salary_month: salary.salary_month, remaining_amount: Math.max(Number(payment.amount) - allocatedAmount, 0) }
  })).filter((payment) => payment.remaining_amount > 0)
  return rows.map((row) => toSalary(row, availablePayments))
}

export async function generateMonthlySalaries(salaryMonth: string) {
  const { data, error } = await supabase.rpc('generate_monthly_salaries', { target_month: `${salaryMonth.slice(0, 7)}-01` })
  if (error) throw error
  return Number(data)
}

export async function getSalaryMonthClosePreview(targetMonth: string) {
  const { data, error } = await supabase.rpc('preview_salary_month_close', { target_month: `${targetMonth.slice(0, 7)}-01` })
  if (error) throw error
  return (data as SalaryClosePreview[]).map((row) => ({
    ...row,
    net_salary: Number(row.net_salary),
    available_cash: Number(row.available_cash),
    available_card: Number(row.available_card),
    cash_to_expense: Number(row.cash_to_expense),
    card_to_apply: Number(row.card_to_apply),
    carryover_cash: Number(row.carryover_cash),
    carryover_card: Number(row.carryover_card),
    outstanding: Number(row.outstanding),
  }))
}

export async function closePreviousSalaryMonthAndGenerate(targetMonth: string) {
  const { data, error } = await supabase.rpc('close_previous_salary_month_and_generate', { target_month: `${targetMonth.slice(0, 7)}-01` })
  if (error) throw error
  return data as SalaryMonthCloseResult
}

async function getApplicableRate(employeeId: string, salaryMonth: string) {
  const { data, error } = await supabase.from('employee_daily_rates').select('daily_rate').eq('employee_id', employeeId).lte('effective_from', salaryMonth).order('effective_from', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This employee does not have a daily rate effective for the selected month.')
  return Number(data.daily_rate)
}

export async function ensureMonthlySalary(employeeId: string, salaryMonth: string) {
  const monthDate = `${salaryMonth.slice(0, 7)}-01`
  const { data: existing, error: lookupError } = await supabase.from('monthly_salaries').select('id').eq('employee_id', employeeId).eq('salary_month', monthDate).maybeSingle()
  if (lookupError) throw lookupError
  if (existing) return existing.id as string
  const dailyRate = await getApplicableRate(employeeId, monthDate)
  const { data, error } = await supabase.from('monthly_salaries').insert({ employee_id: employeeId, salary_month: monthDate, daily_rate_snapshot: dailyRate }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function updateMonthlySalary(id: string, input: SalaryWorkInput) {
  const { error } = await supabase.from('monthly_salaries').update(input).eq('id', id)
  if (error) throw error
}

export async function createSalaryPayment(input: SalaryPaymentInput) {
  const { error } = await supabase.from('salary_payments').insert(input)
  if (error) throw error
}

export async function removeSalaryPayment(id: string) {
  const { error } = await supabase.from('salary_payments').delete().eq('id', id)
  if (error) throw error
}

export async function removeMonthlySalary(id: string) {
  const { error } = await supabase.from('monthly_salaries').delete().eq('id', id)
  if (error) throw error
}

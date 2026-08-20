import { supabase } from '../../lib/supabase'
import type { Employee, EmployeeRate, MonthlySalary, SalaryClosePreview, SalaryMonthCloseResult, SalaryPayment, SalaryPaymentApplication, SalaryPaymentInput, SalaryStatus, SalaryWorkInput } from './types'
import { getBusinessDate } from '../../lib/businessDate'
import { fetchAllPages } from '../../lib/pagination'
import { roundMoney, sumMoney } from '../../lib/money'
import { assignOpenSalaryPayments } from './salaryCalculations'

interface EmployeeRow extends Omit<Employee, 'rates' | 'current_rate'> {
  employee_daily_rates: EmployeeRate[] | null
}

interface PaymentAllocationRow {
  id: string
  payment_id: string
  monthly_salary_id: string
  amount: number
}

interface SalaryPaymentRow extends SalaryPayment {
  salary_payment_allocations: PaymentAllocationRow[] | null
  monthly_salaries: {
    employee_id: string
    salary_month: string
    closed_at: string | null
  }
}

interface SalaryRow extends Omit<MonthlySalary, 'employee' | 'payments' | 'gross_salary' | 'meal_deduction' | 'card_transferred' | 'cash_paid' | 'cash_credit' | 'card_credit' | 'total_paid' | 'receivable_salary' | 'status'> {
  employees: Pick<Employee, 'id' | 'name'>
}

interface AvailablePayment extends SalaryPaymentRow {
  employee_id: string
  origin_salary_month: string
  origin_closed_at: string | null
  remaining_amount: number
}

type PaymentAssignments = Map<string, AvailablePayment[]>

function toEmployee(row: EmployeeRow): Employee {
  const rates = [...(row.employee_daily_rates ?? [])].sort((a, b) => b.effective_from.localeCompare(a.effective_from))
  const currentRate = rates.find((rate) => rate.effective_from <= getBusinessDate())
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    created_at: row.created_at,
    rates,
    current_rate: currentRate ? Number(currentRate.daily_rate) : null,
  }
}

function toSalary(row: SalaryRow, assignedPayments: AvailablePayment[]): MonthlySalary {
  const payments: SalaryPaymentApplication[] = assignedPayments.map((payment) => ({
    id: payment.id,
    monthly_salary_id: payment.monthly_salary_id,
    payment_date: payment.payment_date,
    payment_type: payment.payment_type,
    amount: Number(payment.amount),
    note: payment.note,
    created_at: payment.created_at,
    applied_amount: Number(payment.remaining_amount),
    origin_salary_month: payment.origin_salary_month,
    can_delete: payment.origin_closed_at === null,
  }))
  const grossSalary = roundMoney(Number(row.days_worked) * Number(row.daily_rate_snapshot))
  const mealDeduction = roundMoney(Number(row.meal_count) * Number(row.meal_rate_snapshot))
  const cardTransferred = row.closed_at
    ? Number(row.closed_card_amount)
    : sumMoney(assignedPayments.filter((payment) => payment.payment_type === 'card_transfer').map((payment) => payment.remaining_amount))
  const cashPaid = row.closed_at
    ? Number(row.closed_cash_amount)
    : sumMoney(assignedPayments.filter((payment) => payment.payment_type === 'cash_payment').map((payment) => payment.remaining_amount))
  const cashCredit = row.closed_at ? 0 : sumMoney(assignedPayments.filter((payment) => payment.payment_type === 'cash_payment' && payment.origin_salary_month < row.salary_month).map((payment) => payment.remaining_amount))
  const cardCredit = row.closed_at ? 0 : sumMoney(assignedPayments.filter((payment) => payment.payment_type === 'card_transfer' && payment.origin_salary_month < row.salary_month).map((payment) => payment.remaining_amount))
  const totalPaid = sumMoney([cardTransferred, cashPaid])
  const receivableSalary = row.closed_at ? 0 : roundMoney(grossSalary - mealDeduction - totalPaid)
  const status: SalaryStatus = row.closed_at ? 'closed' : receivableSalary < 0 ? 'overpaid' : receivableSalary === 0 && grossSalary > 0 ? 'paid' : totalPaid > 0 || grossSalary > 0 ? 'in_progress' : 'draft'
  const { employees, ...salary } = row
  return { ...salary, closed_cash_amount: Number(row.closed_cash_amount), closed_card_amount: Number(row.closed_card_amount), employee: employees, payments, gross_salary: grossSalary, meal_deduction: mealDeduction, card_transferred: cardTransferred, cash_paid: cashPaid, cash_credit: cashCredit, card_credit: cardCredit, total_paid: totalPaid, receivable_salary: receivableSalary, status }
}

export async function getEmployees() {
  const rows = await fetchAllPages<EmployeeRow>(async (from, to) => {
    const { data, error } = await supabase.from('employees').select('*, employee_daily_rates(*)').order('name').order('id').order('effective_from', { referencedTable: 'employee_daily_rates', ascending: false }).range(from, to)
    return { data: data as EmployeeRow[] | null, error }
  })
  return rows.map(toEmployee)
}

export async function createEmployee(name: string, dailyRate: number, effectiveFrom: string) {
  const { error } = await supabase.rpc('create_employee_with_rate', {
    p_name: name,
    p_daily_rate: dailyRate,
    p_effective_from: effectiveFrom,
  })
  if (error) throw error
}

export async function addEmployeeRate(employeeId: string, dailyRate: number, effectiveFrom: string) {
  const { error } = await supabase.from('employee_daily_rates').insert({ employee_id: employeeId, daily_rate: dailyRate, effective_from: effectiveFrom })
  if (error) throw error
}

export async function getSalaries() {
  const [rows, paymentRows] = await Promise.all([
    fetchAllPages<SalaryRow>(async (from, to) => {
      const { data, error } = await supabase.from('monthly_salaries').select('*, employees(id, name)').order('salary_month', { ascending: false }).order('employee_id').order('id').range(from, to)
      return { data: data as SalaryRow[] | null, error }
    }),
    fetchAllPages<SalaryPaymentRow>(async (from, to) => {
      const { data, error } = await supabase.from('salary_payments').select('*, monthly_salaries!inner(employee_id, salary_month, closed_at), salary_payment_allocations(id, payment_id, monthly_salary_id, amount)').order('payment_date').order('created_at').order('id').range(from, to)
      return { data: data as SalaryPaymentRow[] | null, error }
    }),
  ])

  const availablePayments = paymentRows.map((payment) => {
    const allocatedAmount = sumMoney((payment.salary_payment_allocations ?? []).map((allocation) => Number(allocation.amount)))
    return {
      ...payment,
      employee_id: payment.monthly_salaries.employee_id,
      origin_salary_month: payment.monthly_salaries.salary_month,
      origin_closed_at: payment.monthly_salaries.closed_at,
      remaining_amount: Math.max(roundMoney(Number(payment.amount) - allocatedAmount), 0),
    }
  }).filter((payment) => payment.remaining_amount > 0)

  const openAssignments = assignOpenSalaryPayments(rows, availablePayments)
  const closedAssignments: PaymentAssignments = new Map()
  paymentRows.forEach((payment) => payment.salary_payment_allocations?.forEach((allocation) => {
    const current = closedAssignments.get(allocation.monthly_salary_id) ?? []
    current.push({
      ...payment,
      employee_id: payment.monthly_salaries.employee_id,
      origin_salary_month: payment.monthly_salaries.salary_month,
      origin_closed_at: payment.monthly_salaries.closed_at,
      remaining_amount: Number(allocation.amount),
    })
    closedAssignments.set(allocation.monthly_salary_id, current)
  }))

  return rows.map((row) => toSalary(row, row.closed_at ? closedAssignments.get(row.id) ?? [] : openAssignments.get(row.id) ?? []))
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

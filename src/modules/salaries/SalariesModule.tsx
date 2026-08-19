import { BadgeDollarSign, Banknote, CalendarDays, CalendarPlus, Download, History, Pencil, Plus, Search, Trash2, UserPlus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AddEmployeeModal } from './components/AddEmployeeModal'
import { AddRateModal } from './components/AddRateModal'
import { AddSalaryModal } from './components/AddSalaryModal'
import { AddSalaryPaymentModal } from './components/AddSalaryPaymentModal'
import { CloseSalaryMonthModal } from './components/CloseSalaryMonthModal'
import { EditSalaryModal } from './components/EditSalaryModal'
import { RecordCashPaymentModal } from './components/RecordCashPaymentModal'
import { SalaryPaymentHistoryModal } from './components/SalaryPaymentHistoryModal'
import { addEmployeeRate, closePreviousSalaryMonthAndGenerate, createEmployee, createSalaryPayment, ensureMonthlySalary, getEmployees, getSalaries, getSalaryMonthClosePreview, removeMonthlySalary, removeSalaryPayment, updateMonthlySalary } from './salaryService'
import type { Employee, MonthlySalary, SalaryClosePreview, SalaryMonthCloseResult, SalaryPaymentInput, SalaryStatus, SalaryWorkInput } from './types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const today = new Date()
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
const statusLabels: Record<SalaryStatus, string> = { draft: 'Draft', in_progress: 'In progress', paid: 'Paid', overpaid: 'Payments exceed earned', closed: 'Closed' }

export function SalariesModule() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [salaries, setSalaries] = useState<MonthlySalary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState(`month:${currentMonth}`)
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false)
  const [addRateOpen, setAddRateOpen] = useState(false)
  const [addSalaryOpen, setAddSalaryOpen] = useState(false)
  const [cashPaymentOpen, setCashPaymentOpen] = useState(false)
  const [closePreview, setClosePreview] = useState<SalaryClosePreview[] | null>(null)
  const [editSalary, setEditSalary] = useState<MonthlySalary | null>(null)
  const [paymentSalary, setPaymentSalary] = useState<MonthlySalary | null>(null)
  const [historySalary, setHistorySalary] = useState<MonthlySalary | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function reload() {
    const [employeeRows, salaryRows] = await Promise.all([getEmployees(), getSalaries()])
    setEmployees(employeeRows)
    setSalaries(salaryRows)
    return salaryRows
  }

  useEffect(() => { reload().catch((error: Error) => setError(error.message)).finally(() => setLoading(false)) }, [])

  const periods = useMemo(() => {
    const months = [...new Set(salaries.map((salary) => salary.salary_month.slice(0, 7)).concat(currentMonth))].sort().reverse()
    return { months, years: [...new Set(months.map((month) => month.slice(0, 4)))].sort().reverse() }
  }, [salaries])

  const filtered = useMemo(() => salaries.filter((salary) => salary.salary_month.startsWith(period.split(':')[1]) && `${salary.employee.name} ${salary.notes ?? ''}`.toLowerCase().includes(search.toLowerCase())), [salaries, search, period])
  const totals = filtered.reduce((result, salary) => ({ gross: result.gross + salary.gross_salary, paid: result.paid + salary.total_paid, meals: result.meals + salary.meal_deduction, receivable: result.receivable + salary.receivable_salary }), { gross: 0, paid: 0, meals: 0, receivable: 0 })

  async function runSaving(action: () => Promise<void>, fallback: string) {
    setSaving(true); setError('')
    try { await action() }
    catch (error) { setError(error instanceof Error ? error.message : fallback) }
    finally { setSaving(false) }
  }

  async function addEmployee(name: string, dailyRate: number, effectiveFrom: string) {
    await runSaving(async () => { await createEmployee(name, dailyRate, effectiveFrom); await reload(); setAddEmployeeOpen(false) }, 'Could not add the employee.')
  }

  async function addRate(employeeId: string, dailyRate: number, effectiveFrom: string) {
    await runSaving(async () => { await addEmployeeRate(employeeId, dailyRate, effectiveFrom); await reload(); setAddRateOpen(false) }, 'Could not save the new rate.')
  }

  async function addSalary(employeeId: string, salaryMonth: string) {
    await runSaving(async () => { await ensureMonthlySalary(employeeId, salaryMonth); await reload(); setAddSalaryOpen(false); setPeriod(`month:${salaryMonth}`) }, 'Could not add the monthly salary.')
  }

  function closeNotice(result: SalaryMonthCloseResult) {
    const closedLabel = monthFormatter.format(new Date(`${result.closed_month}T12:00:00`))
    const targetLabel = monthFormatter.format(new Date(`${result.target_month}T12:00:00`))
    if (result.already_closed && result.salaries_created === 0) return `${closedLabel} was already closed and ${targetLabel} already includes every active employee.`
    if (result.already_closed) return `Created ${result.salaries_created} salary ${result.salaries_created === 1 ? 'record' : 'records'} for ${targetLabel}. ${closedLabel} was already closed.`
    return `Closed ${closedLabel}, created ${result.expenses_created} cash ${result.expenses_created === 1 ? 'expense' : 'expenses'} totaling ${currency.format(Number(result.cash_expensed))}, and created ${result.salaries_created} ${targetLabel} salary ${result.salaries_created === 1 ? 'record' : 'records'}.`
  }

  async function finishCurrentMonthCreation() {
    const result = await closePreviousSalaryMonthAndGenerate(currentMonth)
    await reload()
    setClosePreview(null)
    setPeriod(`month:${currentMonth}`)
    setNotice(closeNotice(result))
  }

  async function prepareCurrentMonth() {
    setSaving(true); setError(''); setNotice('')
    try {
      const preview = await getSalaryMonthClosePreview(currentMonth)
      if (preview.length > 0) setClosePreview(preview)
      else await finishCurrentMonthCreation()
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not prepare the current month payroll.') }
    finally { setSaving(false) }
  }

  async function confirmCurrentMonth() {
    setSaving(true); setError('')
    try { await finishCurrentMonthCreation() }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not close the previous month.') }
    finally { setSaving(false) }
  }

  async function recordCashPayment(input: { employeeId: string; salaryMonth: string; paymentDate: string; amount: number; note: string }) {
    await runSaving(async () => {
      const salaryId = await ensureMonthlySalary(input.employeeId, input.salaryMonth)
      await createSalaryPayment({ monthly_salary_id: salaryId, payment_date: input.paymentDate, payment_type: 'cash_payment', amount: input.amount, note: input.note })
      await reload(); setCashPaymentOpen(false); setPeriod(`month:${input.salaryMonth}`)
    }, 'Could not record the cash payment.')
  }

  async function saveSalary(input: SalaryWorkInput) {
    if (!editSalary) return
    await runSaving(async () => { await updateMonthlySalary(editSalary.id, input); await reload(); setEditSalary(null) }, 'Could not update the salary.')
  }

  async function addPayment(input: SalaryPaymentInput) {
    if (input.payment_date > new Date().toISOString().slice(0, 10)) { setError('Payment date cannot be in the future.'); return }
    if (input.amount <= 0) { setError('Payment must be greater than zero.'); return }
    await runSaving(async () => { await createSalaryPayment(input); await reload(); setPaymentSalary(null) }, 'Could not record the salary payment.')
  }

  async function deletePayment(paymentId: string) {
    if (!window.confirm('Are you sure you want to delete this salary payment?')) return
    try {
      await removeSalaryPayment(paymentId)
      const updated = await reload()
      setHistorySalary((current) => current ? updated.find((salary) => salary.id === current.id) ?? null : null)
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not delete the salary payment.') }
  }

  async function deleteSalary(id: string) {
    if (!window.confirm('Are you sure you want to delete this monthly salary and all its payments?')) return
    try { await removeMonthlySalary(id); setSalaries((current) => current.filter((salary) => salary.id !== id)) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not delete the monthly salary.') }
  }

  function openEmployeeRequired(open: () => void) {
    if (employees.length === 0) { setError('Add an employee before creating salaries or payments.'); return }
    open()
  }

  function exportCsv() {
    const rows = [['Month', 'Employee', 'Daily rate', 'Days worked', 'Gross salary', 'Card transferred', 'Cash payments', 'Cash credit carried in', 'Card credit carried in', 'Meals', 'Meal deduction', 'Receivable salary', 'Closed at'], ...filtered.map((salary) => [salary.salary_month.slice(0, 7), salary.employee.name, String(salary.daily_rate_snapshot), String(salary.days_worked), String(salary.gross_salary), String(salary.card_transferred), String(salary.cash_paid), String(salary.cash_credit), String(salary.card_credit), String(salary.meal_count), String(salary.meal_deduction), String(salary.receivable_salary), salary.closed_at ?? ''])]
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `salaries-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }

  return <>
    <header><div><p className="eyebrow">MONTHLY PAYROLL</p><h1>Salaries</h1><p>Track employee rates, work days, meals, and cash or card salary payments.</p></div><div className="header-actions"><button className="button secondary" onClick={exportCsv}><Download size={16} /> Export</button><button className="button secondary" onClick={() => openEmployeeRequired(() => setCashPaymentOpen(true))}><Banknote size={16} /> Record cash payment</button><button className="button primary" disabled={saving} onClick={prepareCurrentMonth}><CalendarPlus size={17} /> Create current month</button></div></header>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
    {notice && <div className="error-banner success-banner">{notice}<button onClick={() => setNotice('')}><X size={15} /></button></div>}
    <section className="panel">
      <div className="panel-heading"><div><h3>Monthly salaries</h3><p>Daily rates are snapshotted separately for every month</p></div><label className="period-select"><CalendarDays size={15} /><select value={period} onChange={(event) => setPeriod(event.target.value)}><optgroup label="Whole year">{periods.years.map((year) => <option key={year} value={`year:${year}`}>{year} — whole year</option>)}</optgroup><optgroup label="By month">{periods.months.map((month) => <option key={month} value={`month:${month}`}>{monthFormatter.format(new Date(`${month}-01T12:00:00`))}</option>)}</optgroup></select></label></div>
      <div className="toolbar"><label className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees..." /></label><button className="button secondary compact-button" onClick={() => setAddEmployeeOpen(true)}><UserPlus size={15} /> Add employee</button><button className="button secondary compact-button" disabled={employees.length === 0} onClick={() => setAddRateOpen(true)}><BadgeDollarSign size={15} /> Change rate</button><button className="button secondary compact-button" disabled={employees.length === 0} onClick={() => setAddSalaryOpen(true)}><Plus size={15} /> Add one salary</button><span className="results">{filtered.length} entries</span></div>
      <div className="table-wrap salary-table"><table><thead><tr><th>Employee</th><th>Rate / days</th><th className="amount">Gross</th><th className="amount">Card</th><th className="amount">Cash payments</th><th>Meals</th><th className="amount">Receivable</th><th>Status</th><th>Actions</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan={10} className="empty">Loading salaries…</td></tr> : filtered.length === 0 ? <tr><td colSpan={10} className="empty">No salaries for this period.</td></tr> : filtered.map((salary) => <tr key={salary.id}>
        <td><div className="merchant"><span className="merchant-icon violet">{salary.employee.name[0]}</span><div><strong>{salary.employee.name}</strong><span>{salary.notes || monthFormatter.format(new Date(`${salary.salary_month}T12:00:00`))}</span></div></div></td>
        <td><strong>{currency.format(Number(salary.daily_rate_snapshot))}</strong><div className="paid-detail">{salary.days_worked} days</div></td>
        <td className="amount"><strong>{currency.format(salary.gross_salary)}</strong></td><td className="amount">{currency.format(salary.card_transferred)}{salary.card_credit > 0 && <div className="paid-detail">{currency.format(salary.card_credit)} carried in</div>}</td><td className="amount">{currency.format(salary.cash_paid)}{salary.cash_credit > 0 && <div className="paid-detail">{currency.format(salary.cash_credit)} carried in</div>}</td>
        <td>{salary.meal_count}<div className="paid-detail">−{currency.format(salary.meal_deduction)}</div></td><td className="amount"><strong className={salary.receivable_salary < 0 ? 'negative-amount' : ''}>{currency.format(salary.receivable_salary)}</strong></td>
        <td><span className={`status ${salary.status === 'paid' || salary.status === 'closed' ? 'paid' : 'pending'}`}><i />{statusLabels[salary.status]}</span></td>
        <td><div className="row-actions"><button className="icon-button" disabled={Boolean(salary.closed_at)} title={salary.closed_at ? 'Closed salaries cannot be edited' : 'Edit days and meals'} onClick={() => setEditSalary(salary)}><Pencil size={15} /></button><button className="icon-button payment" disabled={Boolean(salary.closed_at)} title={salary.closed_at ? 'Closed salaries cannot receive payments' : 'Record salary payment'} onClick={() => setPaymentSalary(salary)}><Banknote size={15} /></button><button className="icon-button" title="Payment history" onClick={() => setHistorySalary(salary)}><History size={15} /></button></div></td><td><button className="icon-button delete" disabled={Boolean(salary.closed_at)} title={salary.closed_at ? 'Closed salaries cannot be deleted' : 'Delete salary'} onClick={() => deleteSalary(salary.id)}><Trash2 size={15} /></button></td>
      </tr>)}</tbody>{!loading && <tfoot><tr><td colSpan={2} className="total-label">Totals</td><td className="amount total-amount">{currency.format(totals.gross)}</td><td colSpan={2} className="amount total-amount">{currency.format(totals.paid)}</td><td className="amount total-amount">−{currency.format(totals.meals)}</td><td className="amount total-amount">{currency.format(totals.receivable)}</td><td colSpan={3} /></tr></tfoot>}</table></div>
      <div className="panel-footer">Showing {filtered.length} of {salaries.length} salary records <span>{employees.length} employees</span></div>
    </section>
    {addEmployeeOpen && <AddEmployeeModal saving={saving} onClose={() => setAddEmployeeOpen(false)} onSubmit={addEmployee} />}
    {addRateOpen && <AddRateModal employees={employees} saving={saving} onClose={() => setAddRateOpen(false)} onSubmit={addRate} />}
    {addSalaryOpen && <AddSalaryModal employees={employees} defaultMonth={currentMonth} saving={saving} onClose={() => setAddSalaryOpen(false)} onSubmit={addSalary} />}
    {cashPaymentOpen && <RecordCashPaymentModal employees={employees} defaultMonth={currentMonth} saving={saving} onClose={() => setCashPaymentOpen(false)} onSubmit={recordCashPayment} />}
    {closePreview && <CloseSalaryMonthModal preview={closePreview} targetMonth={currentMonth} saving={saving} onClose={() => setClosePreview(null)} onConfirm={confirmCurrentMonth} />}
    {editSalary && <EditSalaryModal salary={editSalary} saving={saving} onClose={() => setEditSalary(null)} onSubmit={saveSalary} />}
    {paymentSalary && <AddSalaryPaymentModal salary={paymentSalary} saving={saving} onClose={() => setPaymentSalary(null)} onSubmit={addPayment} />}
    {historySalary && <SalaryPaymentHistoryModal salary={historySalary} onClose={() => setHistorySalary(null)} onDelete={deletePayment} />}
  </>
}

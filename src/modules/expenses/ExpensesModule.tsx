import { Banknote, CalendarDays, Download, FolderKanban, Plus, Search, SlidersHorizontal, Truck, WalletCards, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AddExpenseModal } from './components/AddExpenseModal'
import { DeleteExpenseModal } from './components/DeleteExpenseModal'
import { ExpensesTable } from './components/ExpensesTable'
import { categories, paymentMethods } from './constants'
import { createExpense, getExpenses, removeExpense } from './expenseService'
import type { Expense, ExpenseInput } from './types'
import type { AppRole } from '../access/types'
import { canDeleteOwnedRecord } from '../access/types'
import { formatDate, getBusinessDate, getBusinessMonth } from '../../lib/businessDate'
import { roundMoney } from '../../lib/money'
import { sortByEnteredDateDesc } from '../../lib/dateSort'
import { getCashAccounts } from '../cash-accounts/cashAccountService'
import type { CashAccount } from '../cash-accounts/types'
import { getProjectOptions } from '../projects/projectService'
import type { ProjectOption } from '../projects/types'
import { getFuelCardBalances, getTruckSummaries } from '../trucks/truckService'
import type { FuelCardBalance, TruckSummary } from '../trucks/types'

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

interface Props { role: AppRole; currentUserId: string }

export function ExpensesModule({ role, currentUserId }: Props) {
  const currentMonth = getBusinessMonth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [fuelCards, setFuelCards] = useState<FuelCardBalance[]>([])
  const [trucks, setTrucks] = useState<TruckSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All categories')
  const [paymentMethod, setPaymentMethod] = useState('All payment methods')
  const [cashAccount, setCashAccount] = useState('All cash accounts')
  const [project, setProject] = useState('All projects')
  const [truck, setTruck] = useState('All trucks')
  const [period, setPeriod] = useState(`month:${currentMonth}`)
  const [saving, setSaving] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getExpenses(), getCashAccounts(), getProjectOptions(), getFuelCardBalances(), getTruckSummaries()])
      .then(([rows, accounts, projectOptions, cardOptions, truckOptions]) => {
        setExpenses(sortByEnteredDateDesc(rows, (expense) => expense.expense_date, (expense) => expense.created_at))
        setCashAccounts(accounts)
        setProjects(projectOptions)
        setFuelCards(cardOptions)
        setTrucks(truckOptions)
        const mainCashAccount = accounts.find((account) => account.account_type === 'main')
        if (mainCashAccount) setCashAccount(mainCashAccount.id)
      })
      .catch((error: Error) => setError(error.message))
      .finally(() => setLoading(false))
  }, [])

  const availablePeriods = useMemo(() => {
    const months = [...new Set(expenses.map((expense) => expense.expense_date.slice(0, 7)).concat(currentMonth))].sort().reverse()
    const years = [...new Set(months.map((month) => month.slice(0, 4)))].sort().reverse()
    return { months, years }
  }, [expenses, currentMonth])

  const filtered = useMemo(() => expenses.filter((expense) => {
    const matchesText = `${expense.merchant} ${expense.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All categories' || expense.category === category
    const matchesPaymentMethod = paymentMethod === 'All payment methods' || expense.payment_method === paymentMethod
    const matchesCashAccount = cashAccount === 'All cash accounts' || expense.cash_account_id === cashAccount
    const matchesProject = project === 'All projects' || (project === 'General / No project' ? expense.project_id === null : expense.project_id === project)
    const matchesTruck = truck === 'All trucks' || (truck === 'General / No truck' ? expense.truck_id === null : expense.truck_id === truck)
    const [periodType, periodValue] = period.split(':')
    const matchesPeriod = periodType === 'year'
      ? expense.expense_date.startsWith(periodValue)
      : expense.expense_date.startsWith(periodValue)
    return matchesText && matchesCategory && matchesPaymentMethod && matchesCashAccount && matchesProject && matchesTruck && matchesPeriod
  }), [expenses, search, category, paymentMethod, cashAccount, project, truck, period])

  async function addExpense(input: ExpenseInput) {
    setSaving(true)
    setError('')
    try {
      const amount = roundMoney(input.quantity * input.unit_price)
      const expense = await createExpense({ ...input, amount })
      setExpenses((current) => sortByEnteredDateDesc([...current, expense], (item) => item.expense_date, (item) => item.created_at))
      setModalOpen(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not add the expense.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteExpense(id: string) {
    setError('')
    setDeleting(true)
    try {
      await removeExpense(id)
      setExpenses((current) => current.filter((expense) => expense.id !== id))
      setExpenseToDelete(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not delete the expense.')
    } finally {
      setDeleting(false)
    }
  }

  function exportCsv() {
    const rows = [['Date', 'Merchant', 'Description', 'Quantity', 'Unit', 'Unit price', 'Category', 'Project', 'Truck', 'Payment method', 'Cash account', 'Fuel card', 'Tank reading', 'Status', 'Created by', 'Amount'], ...filtered.map((expense) => [formatDate(expense.expense_date), expense.merchant, expense.description ?? '', String(expense.quantity), expense.unit, String(expense.unit_price), expense.category, expense.project_name ?? 'General', expense.truck_name ?? '', expense.payment_method, expense.cash_account_name ?? '', expense.fuel_card_name ?? '', expense.fuel_tank_reading_liters === null ? '' : String(expense.fuel_tank_reading_liters), expense.status, expense.created_by_email, String(expense.amount)])]
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    link.download = `expenses-${getBusinessDate()}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return <>
    <header>
      <div><p className="eyebrow">COMPANY EXPENSES</p><h1>Expenses</h1><p>Add and manage your company’s daily spending.</p></div>
      <div className="header-actions"><button className="button secondary" onClick={exportCsv}><Download size={16} /> Export</button><button className="button primary" onClick={() => { if (role === 'project_lead' && cashAccounts.length === 0) { setError('No cash account is assigned to you. Ask the Main Accountant to create or assign one.'); return } setModalOpen(true) }}><Plus size={17} /> Add expense</button></div>
    </header>

    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}

    <section className="panel">
      <div className="panel-heading"><div><h3>All expenses</h3><p>Track and manage company spending</p></div>
        <label className="period-select"><CalendarDays size={15} /><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Filter expenses by period">
          <optgroup label="Whole year">{availablePeriods.years.map((year) => <option key={year} value={`year:${year}`}>{year} — whole year</option>)}</optgroup>
          <optgroup label="By month">{availablePeriods.months.map((month) => <option key={month} value={`month:${month}`}>{monthFormatter.format(new Date(`${month}-01T12:00:00`))}</option>)}</optgroup>
        </select></label>
      </div>
      <div className="toolbar">
        <label className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses..." /></label>
        <label className="filter"><SlidersHorizontal size={16} /><select aria-label="Filter expenses by category" value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="filter payment-filter"><Banknote size={16} /><select aria-label="Filter expenses by payment method" value={paymentMethod} onChange={(event) => {
          const nextPaymentMethod = event.target.value
          setPaymentMethod(nextPaymentMethod)
          if (nextPaymentMethod === 'Bank transfer' || nextPaymentMethod === 'Fuel card') setCashAccount('All cash accounts')
        }}><option>All payment methods</option>{paymentMethods.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="filter cash-account-filter"><WalletCards size={16} /><select aria-label="Filter expenses by cash account" value={cashAccount} onChange={(event) => setCashAccount(event.target.value)}><option>All cash accounts</option>{cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <label className="filter project-filter"><FolderKanban size={16} /><select aria-label="Filter expenses by project" value={project} onChange={(event) => setProject(event.target.value)}><option>All projects</option><option>General / No project</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="filter truck-filter"><Truck size={16} /><select aria-label="Filter expenses by truck" value={truck} onChange={(event) => setTruck(event.target.value)}><option>All trucks</option><option>General / No truck</option>{trucks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <span className="results">{filtered.length} entries</span>
      </div>
      <ExpensesTable expenses={filtered} loading={loading} canDelete={(expense) => canDeleteOwnedRecord(role, currentUserId, expense.created_by)} onDelete={setExpenseToDelete} />
      <div className="panel-footer">Showing {filtered.length} of {expenses.length} expenses <span>Updated just now</span></div>
    </section>

    {modalOpen && <AddExpenseModal saving={saving} role={role} cashAccounts={cashAccounts} preferredCashAccountId={cashAccount === 'All cash accounts' ? null : cashAccount} projects={projects} fuelCards={fuelCards} trucks={trucks} onClose={() => setModalOpen(false)} onSubmit={addExpense} />}
    {expenseToDelete && <DeleteExpenseModal expense={expenseToDelete} deleting={deleting} onCancel={() => setExpenseToDelete(null)} onConfirm={() => deleteExpense(expenseToDelete.id)} />}
  </>
}

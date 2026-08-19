import { Banknote, CalendarDays, Download, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AddExpenseModal } from './components/AddExpenseModal'
import { DeleteExpenseModal } from './components/DeleteExpenseModal'
import { ExpensesTable } from './components/ExpensesTable'
import { categories, paymentMethods } from './constants'
import { createExpense, getExpenses, removeExpense } from './expenseService'
import type { Expense, ExpenseInput } from './types'

const now = new Date()
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

export function ExpensesModule() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All categories')
  const [paymentMethod, setPaymentMethod] = useState('All payment methods')
  const [period, setPeriod] = useState(`month:${currentMonth}`)
  const [saving, setSaving] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getExpenses()
      .then(setExpenses)
      .catch((error: Error) => setError(error.message))
      .finally(() => setLoading(false))
  }, [])

  const availablePeriods = useMemo(() => {
    const months = [...new Set(expenses.map((expense) => expense.expense_date.slice(0, 7)).concat(currentMonth))].sort().reverse()
    const years = [...new Set(months.map((month) => month.slice(0, 4)))].sort().reverse()
    return { months, years }
  }, [expenses])

  const filtered = useMemo(() => expenses.filter((expense) => {
    const matchesText = `${expense.merchant} ${expense.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All categories' || expense.category === category
    const matchesPaymentMethod = paymentMethod === 'All payment methods' || expense.payment_method === paymentMethod
    const [periodType, periodValue] = period.split(':')
    const matchesPeriod = periodType === 'year'
      ? expense.expense_date.startsWith(periodValue)
      : expense.expense_date.startsWith(periodValue)
    return matchesText && matchesCategory && matchesPaymentMethod && matchesPeriod
  }), [expenses, search, category, paymentMethod, period])

  async function addExpense(input: ExpenseInput) {
    setSaving(true)
    setError('')
    try {
      const amount = Number((input.quantity * input.unit_price).toFixed(2))
      const expense = await createExpense({ ...input, amount })
      setExpenses((current) => [expense, ...current])
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
    const rows = [['Date', 'Merchant', 'Description', 'Quantity', 'Unit', 'Unit price', 'Category', 'Payment method', 'Status', 'Amount'], ...filtered.map((expense) => [expense.expense_date, expense.merchant, expense.description ?? '', String(expense.quantity), expense.unit, String(expense.unit_price), expense.category, expense.payment_method, expense.status, String(expense.amount)])]
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    link.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return <>
    <header>
      <div><p className="eyebrow">COMPANY EXPENSES</p><h1>Expenses</h1><p>Add and manage your company’s daily spending.</p></div>
      <div className="header-actions"><button className="button secondary" onClick={exportCsv}><Download size={16} /> Export</button><button className="button primary" onClick={() => setModalOpen(true)}><Plus size={17} /> Add expense</button></div>
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
        <label className="filter payment-filter"><Banknote size={16} /><select aria-label="Filter expenses by payment method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>All payment methods</option>{paymentMethods.map((item) => <option key={item}>{item}</option>)}</select></label>
        <span className="results">{filtered.length} entries</span>
      </div>
      <ExpensesTable expenses={filtered} loading={loading} onDelete={setExpenseToDelete} />
      <div className="panel-footer">Showing {filtered.length} of {expenses.length} expenses <span>Updated just now</span></div>
    </section>

    {modalOpen && <AddExpenseModal saving={saving} onClose={() => setModalOpen(false)} onSubmit={addExpense} />}
    {expenseToDelete && <DeleteExpenseModal expense={expenseToDelete} deleting={deleting} onCancel={() => setExpenseToDelete(null)} onConfirm={() => deleteExpense(expenseToDelete.id)} />}
  </>
}

import { Link2, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatDate } from '../../../lib/businessDate'
import type { Expense } from '../../expenses/types'
import type { Project } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface Props {
  project: Project
  expenses: Expense[]
  loading: boolean
  saving: boolean
  onClose: () => void
  onSubmit: (expenseIds: string[]) => Promise<void>
}

export function AssignExpensesModal({ project, expenses, loading, saving, onClose, onSubmit }: Props) {
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const visibleExpenses = useMemo(() => expenses.filter((expense) => `${expense.merchant} ${expense.description ?? ''}`.toLowerCase().includes(search.toLowerCase())), [expenses, search])
  const selectedTotal = expenses.filter((expense) => selectedIds.includes(expense.id)).reduce((total, expense) => total + Number(expense.amount), 0)
  const allVisibleSelected = visibleExpenses.length > 0 && visibleExpenses.every((expense) => selectedIds.includes(expense.id))

  function toggleAllVisible() {
    const visibleIds = visibleExpenses.map((expense) => expense.id)
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])])
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal assign-expenses-modal">
      <div className="modal-head"><div><span className="modal-icon"><Link2 size={20} /></span><div><h3>Attach existing expenses</h3><p>Link unassigned expenses to {project.name}</p></div></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div>
      <div className="assign-expenses-body">
        <label className="search project-expense-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search unassigned expenses…" /></label>
        <div className="assign-expenses-controls"><label><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={visibleExpenses.length === 0} /> Select all shown</label><span>{selectedIds.length} selected · {currency.format(selectedTotal)}</span></div>
        <div className="assign-expenses-list">
          {loading ? <div className="assignment-empty">Loading expenses…</div> : visibleExpenses.length === 0 ? <div className="assignment-empty">No unassigned expenses match your search.</div> : visibleExpenses.map((expense) => <label key={expense.id} className="assign-expense-row">
            <input type="checkbox" checked={selectedIds.includes(expense.id)} onChange={() => setSelectedIds((current) => current.includes(expense.id) ? current.filter((id) => id !== expense.id) : [...current, expense.id])} />
            <span><strong>{expense.merchant}</strong><small>{formatDate(expense.expense_date)} · {expense.description || expense.category}</small></span>
            <b>{currency.format(Number(expense.amount))}</b>
          </label>)}
        </div>
      </div>
      <div className="modal-actions assignment-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="button" disabled={saving || selectedIds.length === 0} className="button primary" onClick={() => onSubmit(selectedIds)}>{saving ? 'Attaching…' : `Attach ${selectedIds.length || ''} expense${selectedIds.length === 1 ? '' : 's'}`}</button></div>
    </div>
  </div>
}

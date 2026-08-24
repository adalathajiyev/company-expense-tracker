import { Trash2 } from 'lucide-react'
import type { Expense } from '../types'
import { sumMoney } from '../../../lib/money'
import { formatDate } from '../../../lib/businessDate'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const categoryClass: Record<string, string> = { Office: 'blue', Software: 'violet', Travel: 'orange', Meals: 'green', Marketing: 'pink', Utilities: 'yellow', Payroll: 'navy', Other: 'gray' }

interface Props {
  expenses: Expense[]
  loading: boolean
  canDelete: (expense: Expense) => boolean
  onDelete: (expense: Expense) => void
}

export function ExpensesTable({ expenses, loading, canDelete, onDelete }: Props) {
  const displayedTotal = sumMoney(expenses.map((expense) => Number(expense.amount)))

  return <div className="table-wrap"><table className="expenses-table">
    <thead><tr><th>Date</th><th>Merchant / description</th><th>Quantity</th><th className="amount">Unit price</th><th>Category</th><th>Payment</th><th>Cash account</th><th>Status</th><th>Created by</th><th className="amount">Amount</th><th /></tr></thead>
    <tbody>{loading ? <tr><td colSpan={11} className="empty">Loading expenses…</td></tr> : expenses.length === 0 ? <tr><td colSpan={11} className="empty">No expenses match your filters.</td></tr> : expenses.map((expense) => <tr key={expense.id}>
      <td className="date-cell">{formatDate(expense.expense_date)}</td>
      <td><div className="merchant"><span className={`merchant-icon ${categoryClass[expense.category] ?? 'gray'}`}>{expense.merchant[0]}</span><div><strong>{expense.merchant}</strong><span>{expense.description || 'No description'}</span></div></div></td>
      <td>{expense.quantity} {expense.unit}</td>
      <td className="amount">{currency.format(Number(expense.unit_price))}</td>
      <td><span className={`category ${categoryClass[expense.category] ?? 'gray'}`}>{expense.category}</span></td>
      <td>{expense.payment_method}</td><td>{expense.cash_account_name ?? '—'}</td><td><span className={`status ${expense.status}`}><i />{expense.status}</span></td>
      <td className="creator-cell">{expense.created_by_email}</td>
      <td className="amount"><strong>{currency.format(Number(expense.amount))}</strong></td>
      <td><button className="icon-button delete" disabled={Boolean(expense.salary_source_id) || !canDelete(expense)} title={expense.salary_source_id ? 'Generated salary expenses cannot be deleted' : canDelete(expense) ? 'Delete expense' : 'Only the creator or an Admin can delete this expense'} onClick={() => onDelete(expense)}><Trash2 size={15} /></button></td>
    </tr>)}</tbody>
    {!loading && <tfoot><tr>
      <td colSpan={9} className="total-label">Total for displayed expenses</td>
      <td className="amount total-amount">{currency.format(displayedTotal)}</td>
      <td />
    </tr></tfoot>}
  </table></div>
}

import { Trash2 } from 'lucide-react'
import type { Expense } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const categoryClass: Record<string, string> = { Office: 'blue', Software: 'violet', Travel: 'orange', Meals: 'green', Marketing: 'pink', Utilities: 'yellow', Payroll: 'navy', Other: 'gray' }

interface Props {
  expenses: Expense[]
  loading: boolean
  onDelete: (expense: Expense) => void
}

export function ExpensesTable({ expenses, loading, onDelete }: Props) {
  const displayedTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0)

  return <div className="table-wrap"><table>
    <thead><tr><th>Date</th><th>Merchant / description</th><th>Quantity</th><th className="amount">Unit price</th><th>Category</th><th>Payment</th><th>Status</th><th className="amount">Amount</th><th /></tr></thead>
    <tbody>{loading ? <tr><td colSpan={9} className="empty">Loading expenses…</td></tr> : expenses.length === 0 ? <tr><td colSpan={9} className="empty">No expenses match your filters.</td></tr> : expenses.map((expense) => <tr key={expense.id}>
      <td className="date-cell">{shortDate.format(new Date(`${expense.expense_date}T12:00:00`))}</td>
      <td><div className="merchant"><span className={`merchant-icon ${categoryClass[expense.category] ?? 'gray'}`}>{expense.merchant[0]}</span><div><strong>{expense.merchant}</strong><span>{expense.description || 'No description'}</span></div></div></td>
      <td>{expense.quantity} {expense.unit}</td>
      <td className="amount">{currency.format(Number(expense.unit_price))}</td>
      <td><span className={`category ${categoryClass[expense.category] ?? 'gray'}`}>{expense.category}</span></td>
      <td>{expense.payment_method}</td><td><span className={`status ${expense.status}`}><i />{expense.status}</span></td>
      <td className="amount"><strong>{currency.format(Number(expense.amount))}</strong></td>
      <td><button className="icon-button delete" disabled={Boolean(expense.salary_source_id)} title={expense.salary_source_id ? 'Generated salary expenses cannot be deleted' : 'Delete expense'} onClick={() => onDelete(expense)}><Trash2 size={15} /></button></td>
    </tr>)}</tbody>
    {!loading && <tfoot><tr>
      <td colSpan={7} className="total-label">Total for displayed expenses</td>
      <td className="amount total-amount">{currency.format(displayedTotal)}</td>
      <td />
    </tr></tfoot>}
  </table></div>
}

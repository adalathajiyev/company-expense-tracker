import { CalendarCheck, X } from 'lucide-react'
import type { SalaryClosePreview } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

interface Props {
  preview: SalaryClosePreview[]
  targetMonth: string
  saving: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function CloseSalaryMonthModal({ preview, targetMonth, saving, onClose, onConfirm }: Props) {
  const targetDate = new Date(`${targetMonth}-01T12:00:00`)
  const previousDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1, 12)
  const totals = preview.reduce((sum, row) => ({
    net: sum.net + row.net_salary,
    cash: sum.cash + row.cash_to_expense,
    card: sum.card + row.card_to_apply,
    credit: sum.credit + row.carryover_cash + row.carryover_card,
    outstanding: sum.outstanding + row.outstanding,
  }), { net: 0, cash: 0, card: 0, credit: 0, outstanding: 0 })
  const ready = totals.outstanding <= 0

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
    <div className="modal payroll-close-modal" role="dialog" aria-modal="true" aria-labelledby="close-payroll-title">
      <div className="modal-head"><div><span className="modal-icon"><CalendarCheck size={20} /></span><div><h3 id="close-payroll-title">Close {monthFormatter.format(previousDate)}</h3><p>Post cash salaries to expenses and create {monthFormatter.format(targetDate)}</p></div></div><button className="icon-button" disabled={saving} onClick={onClose} aria-label="Close"><X size={19} /></button></div>
      <div className="payroll-close-copy">Card transfers are applied first, then cash payments. Only the remaining salary obligation becomes a cash expense; any excess stays available as credit for the next month.</div>
      <div className="payroll-close-list">
        <div className="payroll-close-row payroll-close-head"><span>Employee</span><span>Net salary</span><span>Cash expense</span><span>Card</span><span>Carryover</span><span>Outstanding</span></div>
        {preview.map((row) => <div className="payroll-close-row" key={row.salary_id}>
          <strong>{row.employee_name}</strong>
          <span>{currency.format(row.net_salary)}</span>
          <span>{currency.format(row.cash_to_expense)}</span>
          <span>{currency.format(row.card_to_apply)}</span>
          <span>{currency.format(row.carryover_cash + row.carryover_card)}</span>
          <span className={row.outstanding > 0 ? 'close-outstanding' : ''}>{row.outstanding > 0 ? currency.format(row.outstanding) : 'Paid'}</span>
        </div>)}
      </div>
      <div className="payroll-close-totals"><span>Total net <strong>{currency.format(totals.net)}</strong></span><span>Cash expenses <strong>{currency.format(totals.cash)}</strong></span><span>Credit forward <strong>{currency.format(totals.credit)}</strong></span></div>
      {!ready && <div className="payroll-close-warning">Record the outstanding salary payments before closing this month.</div>}
      <div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button type="button" className="button primary" disabled={saving || !ready} onClick={onConfirm}>{saving ? 'Closing…' : `Close month & create ${monthFormatter.format(targetDate)}`}</button></div>
    </div>
  </div>
}

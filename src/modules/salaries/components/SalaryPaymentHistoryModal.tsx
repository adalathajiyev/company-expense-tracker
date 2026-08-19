import { History, Trash2, X } from 'lucide-react'
import { paymentTypeLabels } from '../constants'
import type { MonthlySalary } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

interface Props { salary: MonthlySalary; onClose: () => void; onDelete: (paymentId: string) => Promise<void> }

export function SalaryPaymentHistoryModal({ salary, onClose, onDelete }: Props) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal payment-history-modal">
    <div className="modal-head"><div><span className="modal-icon"><History size={20} /></span><div><h3>Salary payment history</h3><p>{salary.employee.name}</p></div></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div>
    <div className="payment-history-list">{salary.payments.length === 0 ? <div className="payment-history-empty">No salary payments have been recorded.</div> : salary.payments.map((payment) => <div className="payment-history-item" key={payment.id}>
      <div><strong>{currency.format(Number(payment.amount))}</strong><span>{dateFormatter.format(new Date(`${payment.payment_date}T12:00:00`))} · {paymentTypeLabels[payment.payment_type]}</span>{payment.note && <small>{payment.note}</small>}</div>
      <button className="icon-button delete" disabled={Boolean(salary.closed_at)} title={salary.closed_at ? 'Payments for a closed salary cannot be deleted' : 'Delete payment'} onClick={() => onDelete(payment.id)}><Trash2 size={15} /></button>
    </div>)}</div>
    <div className="payment-history-total"><span>{salary.closed_at ? 'Total allocated to closed salary' : 'Total available for salary'}{salary.cash_credit + salary.card_credit > 0 && <small>Includes {currency.format(salary.cash_credit + salary.card_credit)} carried credit</small>}</span><strong>{currency.format(Number(salary.total_paid))}</strong></div>
  </div></div>
}

import { History, Trash2, X } from 'lucide-react'
import type { Debt } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

interface Props { debt: Debt; onClose: () => void; onDelete: (paymentId: string) => Promise<void> }

export function DebtPaymentHistoryModal({ debt, onClose, onDelete }: Props) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal payment-history-modal">
    <div className="modal-head"><div><span className="modal-icon"><History size={20} /></span><div><h3>Debt payment history</h3><p>{debt.worker_name}</p></div></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div>
    <div className="payment-history-list">{debt.payments.length === 0 ? <div className="payment-history-empty">No payments have been recorded.</div> : debt.payments.map((payment) => <div className="payment-history-item" key={payment.id}>
      <div><strong>{currency.format(Number(payment.amount))}</strong><span>{dateFormatter.format(new Date(`${payment.payment_date}T12:00:00`))}</span>{payment.note && <small>{payment.note}</small>}</div>
      <button className="icon-button delete" title="Delete payment" onClick={() => onDelete(payment.id)}><Trash2 size={15} /></button>
    </div>)}</div>
    <div className="payment-history-total"><span>Total repaid</span><strong>{currency.format(Number(debt.paid_amount))}</strong></div>
  </div></div>
}

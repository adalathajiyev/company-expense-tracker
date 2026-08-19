import { History, Trash2, X } from 'lucide-react'
import type { Sale } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

interface Props { sale: Sale; onClose: () => void; onDelete: (paymentId: string) => Promise<void> }

export function PaymentHistoryModal({ sale, onClose, onDelete }: Props) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal payment-history-modal">
    <div className="modal-head"><div><span className="modal-icon"><History size={20} /></span><div><h3>Payment history</h3><p>{sale.product}</p></div></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div>
    <div className="payment-history-list">{sale.payments.length === 0 ? <div className="payment-history-empty">No payments have been recorded.</div> : sale.payments.map((payment) => <div className="payment-history-item" key={payment.id}>
      <div><strong>{currency.format(Number(payment.amount))}</strong><span>{dateFormatter.format(new Date(`${payment.payment_date}T12:00:00`))} · {payment.payment_method}</span>{payment.note && <small>{payment.note}</small>}</div>
      <button className="icon-button delete" title="Delete payment" onClick={() => onDelete(payment.id)}><Trash2 size={15} /></button>
    </div>)}</div>
    <div className="payment-history-total"><span>Total received</span><strong>{currency.format(Number(sale.paid_amount))}</strong></div>
  </div></div>
}

import { FormEvent, useState } from 'react'
import { Banknote, X } from 'lucide-react'
import { paymentMethods } from '../constants'
import type { Sale, SalePaymentInput, SalePaymentMethod } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface Props { sale: Sale; saving: boolean; onClose: () => void; onSubmit: (payment: SalePaymentInput) => Promise<void> }

export function AddPaymentModal({ sale, saving, onClose, onSubmit }: Props) {
  const remaining = Number(sale.amount) - Number(sale.paid_amount)
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState<SalePaymentInput>({ sale_id: sale.id, payment_date: today, amount: 0, payment_method: 'Cash', note: '' })

  async function submit(event: FormEvent) { event.preventDefault(); await onSubmit(form) }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><div className="modal confirm-modal">
    <div className="modal-head"><div><span className="modal-icon"><Banknote size={20} /></span><div><h3>Add payment</h3><p>{sale.product}</p></div></div><button className="icon-button" disabled={saving} onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}><div className="payment-summary"><span>Remaining amount</span><strong>{currency.format(remaining)}</strong></div><div className="form-grid">
      <label>Date<span>*</span><input type="date" max={today} required value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} /></label>
      <label>Amount<span>*</span><div className="money-input"><span>₼</span><input autoFocus type="number" min="0.01" max={remaining} step="0.01" required value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value === '' ? 0 : Number(e.target.value) })} /></div></label>
      <label className="wide">Payment method<select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value as SalePaymentMethod })}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
      <label className="wide">Note<textarea value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional payment note" /></label>
    </div><div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Add payment'}</button></div></form>
  </div></div>
}

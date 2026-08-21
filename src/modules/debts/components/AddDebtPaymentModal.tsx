import { FormEvent, useState } from 'react'
import { Banknote, X } from 'lucide-react'
import type { Debt, DebtPaymentInput } from '../types'
import { getBusinessDate } from '../../../lib/businessDate'
import { DateInput } from '../../../components/DateInput'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface Props { debt: Debt; saving: boolean; onClose: () => void; onSubmit: (payment: DebtPaymentInput) => Promise<void> }

export function AddDebtPaymentModal({ debt, saving, onClose, onSubmit }: Props) {
  const remaining = Number(debt.amount) - Number(debt.paid_amount)
  const today = getBusinessDate()
  const [form, setForm] = useState<DebtPaymentInput>({ debt_id: debt.id, payment_date: today, amount: 0, note: '' })

  async function submit(event: FormEvent) { event.preventDefault(); await onSubmit(form) }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><div className="modal confirm-modal">
    <div className="modal-head"><div><span className="modal-icon"><Banknote size={20} /></span><div><h3>Record debt payment</h3><p>{debt.worker_name}</p></div></div><button className="icon-button" disabled={saving} onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}><div className="payment-summary"><span>Remaining debt</span><strong>{currency.format(remaining)}</strong></div><div className="form-grid">
      <label>Date<span>*</span><DateInput max={today} required value={form.payment_date} onChange={(value) => setForm({ ...form, payment_date: value })} /></label>
      <label>Amount<span>*</span><div className="money-input"><span>₼</span><input autoFocus type="number" min="0.01" max={remaining} step="0.01" required value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value === '' ? 0 : Number(e.target.value) })} /></div></label>
      <label className="wide">Note<textarea value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional payment note" /></label>
    </div><div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Add payment'}</button></div></form>
  </div></div>
}

import { FormEvent, useState } from 'react'
import { Banknote, X } from 'lucide-react'
import { paymentTypeLabels } from '../constants'
import type { MonthlySalary, SalaryPaymentInput, SalaryPaymentType } from '../types'
import { getBusinessDate } from '../../../lib/businessDate'
import { DateInput } from '../../../components/DateInput'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface Props { salary: MonthlySalary; saving: boolean; onClose: () => void; onSubmit: (payment: SalaryPaymentInput) => Promise<void> }

export function AddSalaryPaymentModal({ salary, saving, onClose, onSubmit }: Props) {
  const today = getBusinessDate()
  const [form, setForm] = useState<SalaryPaymentInput>({ monthly_salary_id: salary.id, payment_date: today, payment_type: 'cash_payment', amount: 0, note: '' })

  async function submit(event: FormEvent) { event.preventDefault(); await onSubmit(form) }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><div className="modal confirm-modal">
    <div className="modal-head"><div><span className="modal-icon"><Banknote size={20} /></span><div><h3>Record salary payment</h3><p>{salary.employee.name}</p></div></div><button className="icon-button" disabled={saving} onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}><div className="payment-summary"><span>Current receivable</span><strong>{currency.format(Number(salary.receivable_salary))}</strong></div><div className="form-grid">
      <label>Date<span>*</span><DateInput max={today} required value={form.payment_date} onChange={(value) => setForm({ ...form, payment_date: value })} /></label>
      <label>Amount<span>*</span><div className="money-input"><span>₼</span><input autoFocus type="number" min="0.01" step="0.01" required value={form.amount || ''} onChange={(event) => setForm({ ...form, amount: event.target.value === '' ? 0 : Number(event.target.value) })} /></div></label>
      <label className="wide">Payment type<select value={form.payment_type} onChange={(event) => setForm({ ...form, payment_type: event.target.value as SalaryPaymentType })}>{Object.entries(paymentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="wide">Note<textarea value={form.note ?? ''} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Optional payment note" /></label>
    </div><div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Add payment'}</button></div></form>
  </div></div>
}

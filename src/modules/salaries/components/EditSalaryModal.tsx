import { FormEvent, useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { mealRate } from '../constants'
import type { MonthlySalary, SalaryWorkInput } from '../types'
import { roundMoney } from '../../../lib/money'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface Props { salary: MonthlySalary; saving: boolean; onClose: () => void; onSubmit: (input: SalaryWorkInput) => Promise<void> }

export function EditSalaryModal({ salary, saving, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<SalaryWorkInput>({ days_worked: Number(salary.days_worked), meal_count: Number(salary.meal_count), notes: salary.notes ?? '' })
  const gross = roundMoney(form.days_worked * Number(salary.daily_rate_snapshot))
  const receivable = roundMoney(gross - form.meal_count * mealRate - Number(salary.total_paid))

  async function submit(event: FormEvent) { event.preventDefault(); await onSubmit(form) }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><div className="modal">
    <div className="modal-head"><div><span className="modal-icon"><Pencil size={20} /></span><div><h3>Update monthly salary</h3><p>{salary.employee.name}</p></div></div><button className="icon-button" disabled={saving} onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}><div className="form-grid">
      <label>Days worked<span>*</span><input autoFocus type="number" min="0" step="0.5" required value={form.days_worked || ''} onChange={(event) => setForm({ ...form, days_worked: event.target.value === '' ? 0 : Number(event.target.value) })} /></label>
      <label>Meals<span>*</span><input type="number" min="0" step="1" required value={form.meal_count || ''} onChange={(event) => setForm({ ...form, meal_count: event.target.value === '' ? 0 : Number(event.target.value) })} /></label>
      <div className="wide calculated-total"><span>Current receivable</span><strong>{currency.format(receivable)}</strong><small>{currency.format(gross)} gross − {currency.format(form.meal_count * mealRate)} meals − {currency.format(salary.total_paid)} paid</small></div>
      <label className="wide">Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional monthly salary notes" /></label>
    </div><div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save salary'}</button></div></form>
  </div></div>
}

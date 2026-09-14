import { FormEvent, useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { mealRate } from '../constants'
import type { MonthlySalary, SalaryWorkInput } from '../types'
import { roundMoney } from '../../../lib/money'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface Props { salary: MonthlySalary; saving: boolean; onClose: () => void; onSubmit: (input: SalaryWorkInput) => Promise<void> }

export function EditSalaryModal({ salary, saving, onClose, onSubmit }: Props) {
  const [daysWorked, setDaysWorked] = useState(String(Number(salary.days_worked)))
  const [mealCount, setMealCount] = useState(String(Number(salary.meal_count)))
  const [notes, setNotes] = useState(salary.notes ?? '')
  const parsedDaysWorked = Number(daysWorked || 0)
  const parsedMealCount = Number(mealCount || 0)
  const gross = roundMoney(parsedDaysWorked * Number(salary.daily_rate_snapshot))
  const receivable = roundMoney(gross - parsedMealCount * mealRate - Number(salary.total_paid))

  async function submit(event: FormEvent) {
    event.preventDefault()
    await onSubmit({ days_worked: Number(daysWorked), meal_count: Number(mealCount), notes })
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><div className="modal">
    <div className="modal-head"><div><span className="modal-icon"><Pencil size={20} /></span><div><h3>Update monthly salary</h3><p>{salary.employee.name}</p></div></div><button className="icon-button" disabled={saving} onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}><div className="form-grid">
      <label>Days worked<span>*</span><input autoFocus type="number" min="0" step="0.5" required value={daysWorked} onChange={(event) => setDaysWorked(event.target.value)} /></label>
      <label>Meals<span>*</span><input type="number" min="0" step="1" required value={mealCount} onChange={(event) => setMealCount(event.target.value)} /></label>
      <div className="wide calculated-total"><span>Current receivable</span><strong>{currency.format(receivable)}</strong><small>{currency.format(gross)} gross − {currency.format(parsedMealCount * mealRate)} meals − {currency.format(salary.total_paid)} paid</small></div>
      <label className="wide">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional monthly salary notes" /></label>
    </div><div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save salary'}</button></div></form>
  </div></div>
}

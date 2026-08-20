import { FormEvent, useState } from 'react'
import { HandCoins, X } from 'lucide-react'
import type { Employee } from '../types'
import { getBusinessDate } from '../../../lib/businessDate'

interface CashPaymentInput { employeeId: string; salaryMonth: string; paymentDate: string; amount: number; note: string }
interface Props { employees: Employee[]; defaultMonth: string; saving: boolean; onClose: () => void; onSubmit: (input: CashPaymentInput) => Promise<void> }

export function RecordCashPaymentModal({ employees, defaultMonth, saving, onClose, onSubmit }: Props) {
  const today = getBusinessDate()
  const [form, setForm] = useState<CashPaymentInput>({ employeeId: employees[0]?.id ?? '', salaryMonth: defaultMonth, paymentDate: today, amount: 0, note: '' })

  async function submit(event: FormEvent) { event.preventDefault(); await onSubmit(form) }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><div className="modal">
    <div className="modal-head"><div><span className="modal-icon"><HandCoins size={20} /></span><div><h3>Record cash payment</h3><p>A draft monthly salary will be created if needed</p></div></div><button className="icon-button" disabled={saving} onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}><div className="form-grid">
      <label className="wide">Employee<span>*</span><select required value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}><option value="" disabled>Select an employee</option>{employees.filter((employee) => employee.active).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
      <label>Salary month<span>*</span><input type="month" required value={form.salaryMonth} onChange={(event) => setForm({ ...form, salaryMonth: event.target.value })} /></label>
      <label>Payment date<span>*</span><input type="date" max={today} required value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} /></label>
      <label>Cash payment<span>*</span><div className="money-input"><span>₼</span><input type="number" min="0.01" step="0.01" required value={form.amount || ''} onChange={(event) => setForm({ ...form, amount: event.target.value === '' ? 0 : Number(event.target.value) })} /></div></label>
      <label className="wide">Note<textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Optional payment note" /></label>
    </div><div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || !form.employeeId}>{saving ? 'Saving…' : 'Record payment'}</button></div></form>
  </div></div>
}

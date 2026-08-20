import { FormEvent, useState } from 'react'
import { BadgeDollarSign, X } from 'lucide-react'
import type { Employee } from '../types'
import { getBusinessMonth } from '../../../lib/businessDate'

interface Props { employees: Employee[]; saving: boolean; onClose: () => void; onSubmit: (employeeId: string, dailyRate: number, effectiveFrom: string) => Promise<void> }

export function AddRateModal({ employees, saving, onClose, onSubmit }: Props) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '')
  const [dailyRate, setDailyRate] = useState(0)
  const [effectiveFrom, setEffectiveFrom] = useState(`${getBusinessMonth()}-01`)

  async function submit(event: FormEvent) { event.preventDefault(); await onSubmit(employeeId, dailyRate, effectiveFrom) }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><div className="modal confirm-modal">
    <div className="modal-head"><div><span className="modal-icon"><BadgeDollarSign size={20} /></span><div><h3>Change daily rate</h3><p>Previous monthly salary snapshots will not change</p></div></div><button className="icon-button" disabled={saving} onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}><div className="form-grid">
      <label className="wide">Employee<span>*</span><select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="" disabled>Select an employee</option>{employees.filter((employee) => employee.active).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
      <label>New daily rate<span>*</span><div className="money-input"><span>₼</span><input type="number" min="0.01" step="0.01" required value={dailyRate || ''} onChange={(event) => setDailyRate(event.target.value === '' ? 0 : Number(event.target.value))} /></div></label>
      <label>Effective from<span>*</span><input type="date" required value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></label>
    </div><div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || !employeeId}>{saving ? 'Saving…' : 'Save new rate'}</button></div></form>
  </div></div>
}

import { FormEvent, useState } from 'react'
import { CalendarPlus, X } from 'lucide-react'
import type { Employee } from '../types'

interface Props { employees: Employee[]; defaultMonth: string; saving: boolean; onClose: () => void; onSubmit: (employeeId: string, salaryMonth: string) => Promise<void> }

export function AddSalaryModal({ employees, defaultMonth, saving, onClose, onSubmit }: Props) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '')
  const [salaryMonth, setSalaryMonth] = useState(defaultMonth)

  async function submit(event: FormEvent) { event.preventDefault(); await onSubmit(employeeId, salaryMonth) }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><div className="modal confirm-modal">
    <div className="modal-head"><div><span className="modal-icon"><CalendarPlus size={20} /></span><div><h3>Add monthly salary</h3><p>The applicable daily rate will be snapshotted</p></div></div><button className="icon-button" disabled={saving} onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}><div className="form-grid">
      <label className="wide">Employee<span>*</span><select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="" disabled>Select an employee</option>{employees.filter((employee) => employee.active).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
      <label className="wide">Salary month<span>*</span><input type="month" required value={salaryMonth} onChange={(event) => setSalaryMonth(event.target.value)} /></label>
    </div><div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || !employeeId}>{saving ? 'Saving…' : 'Add salary'}</button></div></form>
  </div></div>
}

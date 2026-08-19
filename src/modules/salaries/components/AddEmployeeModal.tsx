import { FormEvent, useState } from 'react'
import { UserPlus, X } from 'lucide-react'

interface Props { saving: boolean; onClose: () => void; onSubmit: (name: string, dailyRate: number, effectiveFrom: string) => Promise<void> }

export function AddEmployeeModal({ saving, onClose, onSubmit }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [name, setName] = useState('')
  const [dailyRate, setDailyRate] = useState(0)
  const [effectiveFrom, setEffectiveFrom] = useState(`${today.slice(0, 7)}-01`)

  async function submit(event: FormEvent) { event.preventDefault(); await onSubmit(name.trim(), dailyRate, effectiveFrom) }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><div className="modal">
    <div className="modal-head"><div><span className="modal-icon"><UserPlus size={20} /></span><div><h3>Add employee</h3><p>Create an employee and their initial daily rate</p></div></div><button className="icon-button" disabled={saving} onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}><div className="form-grid">
      <label className="wide">Employee name<span>*</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Employee's full name" /></label>
      <label>Daily rate<span>*</span><div className="money-input"><span>₼</span><input type="number" min="0.01" step="0.01" required value={dailyRate || ''} onChange={(event) => setDailyRate(event.target.value === '' ? 0 : Number(event.target.value))} /></div></label>
      <label>Effective from<span>*</span><input type="date" required value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></label>
    </div><div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Add employee'}</button></div></form>
  </div></div>
}

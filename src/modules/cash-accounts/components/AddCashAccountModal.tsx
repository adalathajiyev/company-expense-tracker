import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import type { CashAccountInput, CashAccountType, CashAccountUser } from '../types'
import { roleLabels } from '../../access/types'

interface Props {
  users: CashAccountUser[]
  saving: boolean
  onClose: () => void
  onSubmit: (input: CashAccountInput) => Promise<void>
}

export function AddCashAccountModal({ users, saving, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<CashAccountInput>({ name: '', account_type: 'project', description: '', custodian_user_id: null })

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal"><div className="modal-head"><div><span className="modal-icon"><Plus size={20} /></span><div><h3>Add cash account</h3><p>Create a project or employee cash wallet</p></div></div><button type="button" className="icon-button" onClick={onClose}><X size={19} /></button></div>
      <form onSubmit={async (event) => { event.preventDefault(); await onSubmit(form) }}><div className="form-grid">
        <label className="wide">Account name<span>*</span><input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Project A Cash" /></label>
        <label>Account type<span>*</span><select value={form.account_type} onChange={(event) => setForm({ ...form, account_type: event.target.value as Exclude<CashAccountType, 'main'> })}><option value="project">Project cash</option><option value="employee_float">Employee float</option></select></label>
        <label>Custodian<select value={form.custodian_user_id ?? ''} onChange={(event) => setForm({ ...form, custodian_user_id: event.target.value || null })}><option value="">No application user</option>{users.map((user) => <option key={user.user_id} value={user.user_id}>{user.email ?? user.user_id}{user.role ? ` — ${roleLabels[user.role]}` : ' — Unassigned'}</option>)}</select></label>
        <label className="wide">Description<textarea value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Optional purpose or project details" /></label>
      </div><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Add account'}</button></div></form>
    </div>
  </div>
}

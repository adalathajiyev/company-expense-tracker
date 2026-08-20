import { useState, type FormEvent } from 'react'
import { UserPlus, X } from 'lucide-react'

interface Props {
  saving: boolean
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}

export function AddCustomerModal({ saving, onClose, onSubmit }: Props) {
  const [name, setName] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    await onSubmit(name)
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><div className="modal confirm-modal">
    <div className="modal-head"><div><span className="modal-icon"><UserPlus size={20} /></span><div><h3>Add customer</h3><p>Create a customer account for sales and payments</p></div></div><button type="button" className="icon-button" disabled={saving} onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}><div className="form-grid"><label className="wide">Customer name<span>*</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Person or organization" /></label></div><div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Add customer'}</button></div></form>
  </div></div>
}

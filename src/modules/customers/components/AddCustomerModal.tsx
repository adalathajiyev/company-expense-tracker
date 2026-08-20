import { useState, type FormEvent } from 'react'
import { UserPlus, X } from 'lucide-react'
import type { CustomerInput } from '../types'

interface Props {
  saving: boolean
  onClose: () => void
  onSubmit: (input: CustomerInput) => Promise<void>
}

export function AddCustomerModal({ saving, onClose, onSubmit }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [details, setDetails] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || !phone.trim()) return
    await onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      details: details.trim() || null,
    })
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><div className="modal confirm-modal">
    <div className="modal-head"><div><span className="modal-icon"><UserPlus size={20} /></span><div><h3>Add customer</h3><p>Create a customer account for sales and payments</p></div></div><button type="button" className="icon-button" disabled={saving} onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}><div className="form-grid">
      <label className="wide">Customer name<span>*</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Person or organization" /></label>
      <label className="wide">Phone number<span>*</span><input type="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="e.g. +994 50 123 45 67" /></label>
      <label className="wide">Details<textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Optional notes about this customer" /></label>
    </div><div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || !name.trim() || !phone.trim()}>{saving ? 'Saving…' : 'Add customer'}</button></div></form>
  </div></div>
}

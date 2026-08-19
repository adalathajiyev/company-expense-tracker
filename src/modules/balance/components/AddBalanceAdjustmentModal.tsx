import { ArrowDownLeft, ArrowUpRight, Plus, X } from 'lucide-react'
import { FormEvent, useState } from 'react'
import type { BalanceAdjustmentInput } from '../types'

interface Props {
  saving: boolean
  onClose: () => void
  onSubmit: (input: BalanceAdjustmentInput) => Promise<void>
}

const emptyAdjustment: BalanceAdjustmentInput = {
  name: '',
  description: '',
  amount: 0,
  direction: 'receivable',
}

export function AddBalanceAdjustmentModal({ saving, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<BalanceAdjustmentInput>(emptyAdjustment)

  async function submit(event: FormEvent) {
    event.preventDefault()
    await onSubmit({
      ...form,
      name: form.name.trim(),
      description: form.description?.trim() || null,
    })
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
    <div className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="add-balance-adjustment-title">
      <div className="modal-head">
        <div><span className="modal-icon"><Plus size={20} /></span><div><h3 id="add-balance-adjustment-title">Add other payment</h3><p>Record money owed to or by the company</p></div></div>
        <button type="button" className="icon-button" disabled={saving} onClick={onClose} aria-label="Close"><X size={19} /></button>
      </div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="wide">Person or organization<span>*</span><input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Supplier or customer name" /></label>
          <label className="wide">Payment direction<span>*</span><select required value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value as BalanceAdjustmentInput['direction'] })}>
            <option value="receivable">Owed to company — to receive</option>
            <option value="payable">Owed by company — to pay</option>
          </select></label>
          <label className="wide">Amount<span>*</span><div className="money-input"><span>₼</span><input type="number" min="0.01" step="0.01" required value={form.amount || ''} onChange={(event) => setForm({ ...form, amount: event.target.value === '' ? 0 : Number(event.target.value) })} placeholder="0.00" /></div></label>
          <label className="wide">Description<textarea value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What is this payment for?" /></label>
          <div className={`wide balance-direction-preview ${form.direction}`}>
            {form.direction === 'receivable' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
            <span>{form.direction === 'receivable' ? 'This amount will increase the displayed balance.' : 'This amount will decrease the displayed balance.'}</span>
          </div>
        </div>
        <div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Add payment'}</button></div>
      </form>
    </div>
  </div>
}

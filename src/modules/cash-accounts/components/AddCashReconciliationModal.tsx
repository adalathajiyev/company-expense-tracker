import { ClipboardCheck, X } from 'lucide-react'
import { useState } from 'react'
import { DateInput } from '../../../components/DateInput'
import { getBusinessDate } from '../../../lib/businessDate'
import type { CashAccount, CashReconciliationInput } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface Props {
  account: CashAccount
  saving: boolean
  onClose: () => void
  onSubmit: (input: CashReconciliationInput) => Promise<void>
}

export function AddCashReconciliationModal({ account, saving, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<CashReconciliationInput>({ account_id: account.id, reconciliation_date: getBusinessDate(), counted_balance: Math.max(0, Number(account.balance)), notes: '' })
  const variance = Number.isFinite(form.counted_balance) ? form.counted_balance - Number(account.balance) : null

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal"><div className="modal-head"><div><span className="modal-icon"><ClipboardCheck size={20} /></span><div><h3>Reconcile {account.name}</h3><p>Compare the ledger with physically counted cash</p></div></div><button type="button" className="icon-button" onClick={onClose}><X size={19} /></button></div>
      <form onSubmit={async (event) => { event.preventDefault(); await onSubmit(form) }}><div className="form-grid">
        <div className="wide calculated-total"><span>Expected balance</span><strong>{currency.format(Number(account.balance))}</strong><small>Calculated from the account ledger</small></div>
        <label>Date<span>*</span><DateInput required max={getBusinessDate()} value={form.reconciliation_date} onChange={(value) => setForm({ ...form, reconciliation_date: value })} /></label>
        <label>Counted cash<span>*</span><div className="money-input"><span>₼</span><input autoFocus type="number" min="0" step="0.01" required value={Number.isNaN(form.counted_balance) ? '' : form.counted_balance} onChange={(event) => setForm({ ...form, counted_balance: event.target.value === '' ? Number.NaN : Number(event.target.value) })} /></div></label>
        <div className={`wide cash-variance-preview ${variance === 0 ? 'balanced' : 'mismatch'}`}><span>Difference</span><strong>{variance === null ? '—' : `${variance > 0 ? '+' : ''}${currency.format(variance)}`}</strong></div>
        <label className="wide">Notes<textarea value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional explanation for any difference" /></label>
      </div><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save reconciliation'}</button></div></form>
    </div>
  </div>
}
